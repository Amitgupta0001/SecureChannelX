"""
Azure Key Vault Integration
Securely manages secrets with automatic fallback to environment variables for local development.
Cost: ~$0.03 per 10,000 operations (FREE tier available)
"""

import os
from typing import Optional
from azure.keyvault.secrets import SecretClient
from azure.identity import DefaultAzureCredential, ManagedIdentityCredential
from azure.core.exceptions import AzureError

class AzureKeyVaultService:
    """
    Azure Key Vault service with intelligent fallback to environment variables.
    Supports both local development and production Azure environments.
    """
    
    def __init__(self):
        self.client: Optional[SecretClient] = None
        self.enabled = False
        self.vault_name = os.getenv("AZURE_KEY_VAULT_NAME")
        
        # Only initialize if vault name is provided and not a placeholder
        if self.vault_name and not self.vault_name.startswith("your-"):
            self._initialize_client()
    
    def _initialize_client(self):
        """Initialize Key Vault client with proper error handling."""
        try:
            vault_url = f"https://{self.vault_name}.vault.azure.net"
            
            # Try Managed Identity first (for Azure-hosted apps), then default credentials
            try:
                credential = ManagedIdentityCredential()
                self.client = SecretClient(vault_url=vault_url, credential=credential)
                # Test connection
                self.client.get_secret("test-connection")
            except Exception:
                # Fallback to DefaultAzureCredential (for local development with Azure CLI)
                credential = DefaultAzureCredential()
                self.client = SecretClient(vault_url=vault_url, credential=credential)
            
            self.enabled = True
            print(f"✅ Azure Key Vault connected: {self.vault_name}")
            
        except AzureError as e:
            print(f"⚠️  Azure Key Vault unavailable: {str(e)}")
            print("📝 Falling back to environment variables")
            self.enabled = False
        except Exception as e:
            print(f"⚠️  Key Vault initialization error: {str(e)}")
            print("📝 Falling back to environment variables")
            self.enabled = False
    
    def get_secret(self, secret_name: str, default: Optional[str] = None) -> Optional[str]:
        """
        Retrieve a secret from Key Vault or environment variables.
        
        Args:
            secret_name: Name of the secret
            default: Default value if secret not found
            
        Returns:
            Secret value or default
        """
        # Try Key Vault first if enabled
        if self.enabled and self.client:
            try:
                secret = self.client.get_secret(secret_name)
                return secret.value
            except Exception as e:
                print(f"⚠️  Failed to get secret '{secret_name}' from Key Vault: {str(e)}")
        
        # Fallback to environment variable
        env_value = os.getenv(secret_name.upper().replace("-", "_"))
        if env_value:
            return env_value
        
        return default
    
    def set_secret(self, secret_name: str, secret_value: str) -> bool:
        """
        Store a secret in Key Vault.
        
        Args:
            secret_name: Name of the secret
            secret_value: Value to store
            
        Returns:
            True if successful, False otherwise
        """
        if not self.enabled or not self.client:
            print(f"⚠️  Key Vault not available. Cannot store secret '{secret_name}'")
            return False
        
        try:
            self.client.set_secret(secret_name, secret_value)
            print(f"✅ Secret '{secret_name}' stored in Key Vault")
            return True
        except Exception as e:
            print(f"❌ Failed to store secret '{secret_name}': {str(e)}")
            return False
    
    def delete_secret(self, secret_name: str) -> bool:
        """Delete a secret from Key Vault."""
        if not self.enabled or not self.client:
            return False
        
        try:
            self.client.begin_delete_secret(secret_name).wait()
            print(f"✅ Secret '{secret_name}' deleted from Key Vault")
            return True
        except Exception as e:
            print(f"❌ Failed to delete secret '{secret_name}': {str(e)}")
            return False


# Global instance
key_vault_service = AzureKeyVaultService()


# Convenience functions
def get_secret(secret_name: str, default: Optional[str] = None) -> Optional[str]:
    """Get secret from Key Vault or environment variables."""
    return key_vault_service.get_secret(secret_name, default)


def set_secret(secret_name: str, secret_value: str) -> bool:
    """Store secret in Key Vault."""
    return key_vault_service.set_secret(secret_name, secret_value)
