"""
Dependency Vulnerability Scanner
Automated security scanning for Python dependencies
"""

import subprocess
import json
import logging
from datetime import datetime
from typing import Dict, List, Any
import os

logger = logging.getLogger(__name__)


class DependencyScanner:
    """
    Scans Python dependencies for known vulnerabilities
    
    Uses:
    - pip-audit for vulnerability scanning
    - Safety for security checks
    - Bandit for code security analysis
    """
    
    def __init__(self, requirements_file: str = "requirements.txt"):
        self.requirements_file = requirements_file
        self.scan_results = {}
    
    def scan_with_pip_audit(self) -> Dict[str, Any]:
        """Scan dependencies using pip-audit"""
        try:
            logger.info("[SECURITY-SCAN] Running pip-audit...")
            
            result = subprocess.run(
                ["pip-audit", "--format", "json"],
                capture_output=True,
                text=True,
                timeout=300
            )
            
            if result.returncode == 0:
                vulnerabilities = json.loads(result.stdout) if result.stdout else []
                logger.info(f"[SECURITY-SCAN] Found {len(vulnerabilities)} vulnerabilities")
                return {
                    "status": "success",
                    "vulnerabilities": vulnerabilities,
                    "count": len(vulnerabilities)
                }
            else:
                logger.warning(f"[SECURITY-SCAN] pip-audit failed: {result.stderr}")
                return {
                    "status": "error",
                    "error": result.stderr,
                    "count": 0
                }
        
        except FileNotFoundError:
            logger.error("[SECURITY-SCAN] pip-audit not installed")
            return {
                "status": "not_installed",
                "message": "pip-audit not found. Install with: pip install pip-audit",
                "count": 0
            }
        
        except Exception as e:
            logger.error(f"[SECURITY-SCAN] pip-audit error: {e}")
            return {
                "status": "error",
                "error": str(e),
                "count": 0
            }
    
    def scan_with_safety(self) -> Dict[str, Any]:
        """Scan dependencies using Safety"""
        try:
            logger.info("[SECURITY-SCAN] Running Safety...")
            
            result = subprocess.run(
                ["safety", "check", "--json"],
                capture_output=True,
                text=True,
                timeout=300
            )
            
            if result.stdout:
                vulnerabilities = json.loads(result.stdout)
                logger.info(f"[SECURITY-SCAN] Safety found {len(vulnerabilities)} issues")
                return {
                    "status": "success",
                    "vulnerabilities": vulnerabilities,
                    "count": len(vulnerabilities)
                }
            else:
                return {
                    "status": "success",
                    "vulnerabilities": [],
                    "count": 0
                }
        
        except FileNotFoundError:
            logger.error("[SECURITY-SCAN] Safety not installed")
            return {
                "status": "not_installed",
                "message": "Safety not found. Install with: pip install safety",
                "count": 0
            }
        
        except Exception as e:
            logger.error(f"[SECURITY-SCAN] Safety error: {e}")
            return {
                "status": "error",
                "error": str(e),
                "count": 0
            }
    
    def scan_code_with_bandit(self, target_dir: str = "app") -> Dict[str, Any]:
        """Scan code for security issues using Bandit"""
        try:
            logger.info(f"[SECURITY-SCAN] Running Bandit on {target_dir}...")
            
            result = subprocess.run(
                ["bandit", "-r", target_dir, "-f", "json"],
                capture_output=True,
                text=True,
                timeout=300
            )
            
            if result.stdout:
                scan_results = json.loads(result.stdout)
                issues = scan_results.get("results", [])
                logger.info(f"[SECURITY-SCAN] Bandit found {len(issues)} issues")
                return {
                    "status": "success",
                    "issues": issues,
                    "count": len(issues),
                    "metrics": scan_results.get("metrics", {})
                }
            else:
                return {
                    "status": "success",
                    "issues": [],
                    "count": 0
                }
        
        except FileNotFoundError:
            logger.error("[SECURITY-SCAN] Bandit not installed")
            return {
                "status": "not_installed",
                "message": "Bandit not found. Install with: pip install bandit",
                "count": 0
            }
        
        except Exception as e:
            logger.error(f"[SECURITY-SCAN] Bandit error: {e}")
            return {
                "status": "error",
                "error": str(e),
                "count": 0
            }
    
    def run_full_scan(self) -> Dict[str, Any]:
        """Run comprehensive security scan"""
        logger.info("[SECURITY-SCAN] Starting comprehensive security scan...")
        
        results = {
            "timestamp": datetime.utcnow().isoformat(),
            "pip_audit": self.scan_with_pip_audit(),
            "safety": self.scan_with_safety(),
            "bandit": self.scan_code_with_bandit(),
        }
        
        # Calculate total vulnerabilities
        total_vulns = (
            results["pip_audit"].get("count", 0) +
            results["safety"].get("count", 0) +
            results["bandit"].get("count", 0)
        )
        
        results["summary"] = {
            "total_vulnerabilities": total_vulns,
            "critical": self._count_critical(results),
            "high": self._count_high(results),
            "medium": self._count_medium(results),
            "low": self._count_low(results),
        }
        
        logger.info(f"[SECURITY-SCAN] Scan complete. Total issues: {total_vulns}")
        
        self.scan_results = results
        return results
    
    def _count_critical(self, results: Dict) -> int:
        """Count critical vulnerabilities"""
        count = 0
        
        # Bandit critical issues
        if results["bandit"].get("status") == "success":
            count += len([i for i in results["bandit"].get("issues", []) 
                         if i.get("issue_severity") == "HIGH"])
        
        return count
    
    def _count_high(self, results: Dict) -> int:
        """Count high severity vulnerabilities"""
        count = 0
        
        # pip-audit
        if results["pip_audit"].get("status") == "success":
            count += len([v for v in results["pip_audit"].get("vulnerabilities", [])
                         if v.get("severity", "").upper() == "HIGH"])
        
        # Bandit medium issues
        if results["bandit"].get("status") == "success":
            count += len([i for i in results["bandit"].get("issues", [])
                         if i.get("issue_severity") == "MEDIUM"])
        
        return count
    
    def _count_medium(self, results: Dict) -> int:
        """Count medium severity vulnerabilities"""
        count = 0
        
        # pip-audit
        if results["pip_audit"].get("status") == "success":
            count += len([v for v in results["pip_audit"].get("vulnerabilities", [])
                         if v.get("severity", "").upper() == "MEDIUM"])
        
        return count
    
    def _count_low(self, results: Dict) -> int:
        """Count low severity vulnerabilities"""
        count = 0
        
        # pip-audit
        if results["pip_audit"].get("status") == "success":
            count += len([v for v in results["pip_audit"].get("vulnerabilities", [])
                         if v.get("severity", "").upper() == "LOW"])
        
        # Bandit low issues
        if results["bandit"].get("status") == "success":
            count += len([i for i in results["bandit"].get("issues", [])
                         if i.get("issue_severity") == "LOW"])
        
        return count
    
    def generate_report(self, output_file: str = "security_scan_report.json"):
        """Generate security scan report"""
        try:
            with open(output_file, 'w') as f:
                json.dump(self.scan_results, f, indent=2)
            
            logger.info(f"[SECURITY-SCAN] Report saved to {output_file}")
            return output_file
        
        except Exception as e:
            logger.error(f"[SECURITY-SCAN] Failed to generate report: {e}")
            return None
    
    def print_summary(self):
        """Print scan summary"""
        if not self.scan_results:
            print("No scan results available. Run scan first.")
            return
        
        summary = self.scan_results.get("summary", {})
        
        print("\n" + "="*60)
        print("SECURITY SCAN SUMMARY")
        print("="*60)
        print(f"Timestamp: {self.scan_results.get('timestamp')}")
        print(f"\nTotal Vulnerabilities: {summary.get('total_vulnerabilities', 0)}")
        print(f"  Critical: {summary.get('critical', 0)}")
        print(f"  High:     {summary.get('high', 0)}")
        print(f"  Medium:   {summary.get('medium', 0)}")
        print(f"  Low:      {summary.get('low', 0)}")
        print("="*60 + "\n")


def main():
    """Run security scan"""
    scanner = DependencyScanner()
    results = scanner.run_full_scan()
    scanner.print_summary()
    scanner.generate_report()
    
    # Exit with error code if vulnerabilities found
    total_vulns = results["summary"]["total_vulnerabilities"]
    if total_vulns > 0:
        print(f"\n⚠️  Found {total_vulns} security issues!")
        return 1
    else:
        print("\n✅ No security issues found!")
        return 0


if __name__ == "__main__":
    exit(main())
