"""
Azure Blob Storage Integration
Scalable file storage for chat attachments and media files.
Cost: ~$0.02 per GB/month (Hot tier) - pay only for what you use
Local fallback: Uses local filesystem for development
"""

import os
import io
from typing import Optional, List, Dict, BinaryIO
from datetime import datetime, timedelta
from azure.storage.blob import BlobServiceClient, BlobSasPermissions, generate_blob_sas
from azure.core.exceptions import AzureError

class AzureBlobStorageService:
    """
    Azure Blob Storage service with automatic fallback to local filesystem.
    Zero cost for local development, pay-as-you-go for production.
    """
    
    def __init__(self):
        self.client: Optional[BlobServiceClient] = None
        self.container_client = None
        self.enabled = False
        self.connection_string = os.getenv("AZURE_STORAGE_CONNECTION_STRING")
        self.container_name = os.getenv("AZURE_STORAGE_CONTAINER_NAME", "chat-files")
        
        # Local storage fallback directory
        self.local_storage_path = os.path.join(
            os.path.dirname(os.path.dirname(os.path.dirname(__file__))),
            "uploads"
        )
        
        # Only initialize if connection string is provided and not a placeholder
        if self.connection_string and not self.connection_string.startswith("DefaultEndpointsProtocol=https;AccountName=your-"):
            self._initialize_blob_storage()
        else:
            print("📝 Azure Blob Storage disabled - using local filesystem")
            self._setup_local_storage()
    
    def _initialize_blob_storage(self):
        """Initialize Azure Blob Storage client."""
        try:
            self.client = BlobServiceClient.from_connection_string(self.connection_string)
            
            # Get or create container
            self.container_client = self.client.get_container_client(self.container_name)
            
            # Create container if it doesn't exist
            try:
                self.container_client.create_container()
                print(f"✅ Created Azure Blob container: {self.container_name}")
            except Exception:
                # Container already exists
                pass
            
            self.enabled = True
            print(f"✅ Azure Blob Storage connected: {self.container_name}")
            
        except AzureError as e:
            print(f"⚠️  Azure Blob Storage unavailable: {str(e)}")
            print("📝 Falling back to local filesystem")
            self._setup_local_storage()
        except Exception as e:
            print(f"⚠️  Blob Storage initialization error: {str(e)}")
            print("📝 Falling back to local filesystem")
            self._setup_local_storage()
    
    def _setup_local_storage(self):
        """Setup local filesystem storage as fallback."""
        os.makedirs(self.local_storage_path, exist_ok=True)
        print(f"📁 Local storage directory: {self.local_storage_path}")
    
    def upload_file(self, file_data: bytes, file_name: str, 
                   content_type: str = "application/octet-stream") -> Optional[str]:
        """
        Upload a file to Blob Storage or local filesystem.
        
        Args:
            file_data: File content as bytes
            file_name: Name of the file
            content_type: MIME type of the file
            
        Returns:
            URL or path to the uploaded file
        """
        if self.enabled and self.container_client:
            try:
                blob_client = self.container_client.get_blob_client(file_name)
                blob_client.upload_blob(
                    file_data,
                    overwrite=True,
                    content_settings={'content_type': content_type}
                )
                url = blob_client.url
                print(f"✅ File uploaded to Azure: {file_name}")
                return url
            except Exception as e:
                print(f"❌ Failed to upload to Azure: {str(e)}")
                print("📝 Falling back to local storage")
        
        # Fallback to local storage
        try:
            file_path = os.path.join(self.local_storage_path, file_name)
            os.makedirs(os.path.dirname(file_path), exist_ok=True)
            
            with open(file_path, 'wb') as f:
                f.write(file_data)
            
            print(f"✅ File saved locally: {file_name}")
            return f"/uploads/{file_name}"
        except Exception as e:
            print(f"❌ Failed to save file locally: {str(e)}")
            return None
    
    def download_file(self, file_name: str) -> Optional[bytes]:
        """
        Download a file from Blob Storage or local filesystem.
        
        Args:
            file_name: Name of the file
            
        Returns:
            File content as bytes
        """
        if self.enabled and self.container_client:
            try:
                blob_client = self.container_client.get_blob_client(file_name)
                download_stream = blob_client.download_blob()
                return download_stream.readall()
            except Exception as e:
                print(f"⚠️  Failed to download from Azure: {str(e)}")
                print("📝 Trying local storage")
        
        # Fallback to local storage
        try:
            file_path = os.path.join(self.local_storage_path, file_name)
            with open(file_path, 'rb') as f:
                return f.read()
        except Exception as e:
            print(f"❌ Failed to read file locally: {str(e)}")
            return None
    
    def delete_file(self, file_name: str) -> bool:
        """
        Delete a file from Blob Storage or local filesystem.
        
        Args:
            file_name: Name of the file
            
        Returns:
            True if successful, False otherwise
        """
        if self.enabled and self.container_client:
            try:
                blob_client = self.container_client.get_blob_client(file_name)
                blob_client.delete_blob()
                print(f"✅ File deleted from Azure: {file_name}")
                return True
            except Exception as e:
                print(f"⚠️  Failed to delete from Azure: {str(e)}")
        
        # Fallback to local storage
        try:
            file_path = os.path.join(self.local_storage_path, file_name)
            if os.path.exists(file_path):
                os.remove(file_path)
                print(f"✅ File deleted locally: {file_name}")
                return True
        except Exception as e:
            print(f"❌ Failed to delete file locally: {str(e)}")
        
        return False
    
    def list_files(self, prefix: str = "") -> List[Dict[str, Any]]:
        """
        List files in Blob Storage or local filesystem.
        
        Args:
            prefix: Optional prefix to filter files
            
        Returns:
            List of file metadata dictionaries
        """
        files = []
        
        if self.enabled and self.container_client:
            try:
                blobs = self.container_client.list_blobs(name_starts_with=prefix)
                for blob in blobs:
                    files.append({
                        'name': blob.name,
                        'size': blob.size,
                        'last_modified': blob.last_modified,
                        'content_type': blob.content_settings.content_type if blob.content_settings else None
                    })
                return files
            except Exception as e:
                print(f"⚠️  Failed to list Azure files: {str(e)}")
        
        # Fallback to local storage
        try:
            for root, dirs, filenames in os.walk(self.local_storage_path):
                for filename in filenames:
                    if filename.startswith(prefix):
                        file_path = os.path.join(root, filename)
                        stat = os.stat(file_path)
                        files.append({
                            'name': filename,
                            'size': stat.st_size,
                            'last_modified': datetime.fromtimestamp(stat.st_mtime),
                            'content_type': None
                        })
        except Exception as e:
            print(f"❌ Failed to list local files: {str(e)}")
        
        return files
    
    def generate_download_url(self, file_name: str, expiry_hours: int = 1) -> Optional[str]:
        """
        Generate a temporary download URL with SAS token.
        
        Args:
            file_name: Name of the file
            expiry_hours: Hours until URL expires
            
        Returns:
            Temporary download URL
        """
        if not self.enabled or not self.container_client:
            # For local storage, return local path
            return f"/uploads/{file_name}"
        
        try:
            blob_client = self.container_client.get_blob_client(file_name)
            
            # Generate SAS token
            sas_token = generate_blob_sas(
                account_name=self.client.account_name,
                container_name=self.container_name,
                blob_name=file_name,
                account_key=self.client.credential.account_key,
                permission=BlobSasPermissions(read=True),
                expiry=datetime.utcnow() + timedelta(hours=expiry_hours)
            )
            
            return f"{blob_client.url}?{sas_token}"
        except Exception as e:
            print(f"❌ Failed to generate download URL: {str(e)}")
            return None


# Global instance
blob_storage_service = AzureBlobStorageService()


# Convenience functions
def upload_file(file_data: bytes, file_name: str, content_type: str = "application/octet-stream") -> Optional[str]:
    """Upload a file to storage."""
    return blob_storage_service.upload_file(file_data, file_name, content_type)


def download_file(file_name: str) -> Optional[bytes]:
    """Download a file from storage."""
    return blob_storage_service.download_file(file_name)


def delete_file(file_name: str) -> bool:
    """Delete a file from storage."""
    return blob_storage_service.delete_file(file_name)


def list_files(prefix: str = "") -> List[Dict[str, Any]]:
    """List files in storage."""
    return blob_storage_service.list_files(prefix)


def generate_download_url(file_name: str, expiry_hours: int = 1) -> Optional[str]:
    """Generate a temporary download URL."""
    return blob_storage_service.generate_download_url(file_name, expiry_hours)
