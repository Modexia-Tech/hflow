import os
import platform
import subprocess
import sys
import json
from typing import Dict, List, Optional, Tuple
import shutil
import requests
from pathlib import Path

# Constants
NODE_DIST_URL = "https://nodejs.org/dist"
NODE_VERSION = "20.11.1"  # Default version to install

def clear_screen() -> None:
    """Clear the terminal screen cross-platform."""
    os.system('cls' if os.name == 'nt' else 'clear')

def display_banner(title: str = "Python Node.js Manager", version: str = "1.0") -> None:
    """Display a styled banner with title and version."""
    clear_screen()
    border = "=" * 50
    print(f"\n{border}")
    print(f"{title.center(50)}")
    print(f"Version: {version.center(50 - 9)}")  # 9 is len("Version: ")
    print(f"{border}\n")

def pretty_print(text: str, color: str = None, indent: int = 0, width: int = 80) -> None:
    """
    Print formatted text with optional color and indentation.
    Supports basic ANSI colors on supported terminals.
    """
    colors = {
        'red': '\033[91m',
        'green': '\033[92m',
        'yellow': '\033[93m',
        'blue': '\033[94m',
        'magenta': '\033[95m',
        'cyan': '\033[96m',
        'white': '\033[97m',
        'reset': '\033[0m',
    }
    
    color_code = colors.get(color.lower(), '') if color else ''
    reset_code = colors['reset'] if color else ''
    
    # Simple text wrapping
    lines = []
    current_line = []
    current_length = 0
    
    for word in text.split():
        if current_length + len(word) + len(current_line) > width - indent * 2:
            lines.append(" " * indent + " ".join(current_line))
            current_line = [word]
            current_length = len(word)
        else:
            current_line.append(word)
            current_length += len(word)
    
    if current_line:
        lines.append(" " * indent + " ".join(current_line))
    
    print(f"{color_code}{os.linesep.join(lines)}{reset_code}")

def prompt(question: str, default: Optional[str] = None, color: str = "cyan") -> str:
    """
    Prompt user for input with a question and optional default value.
    Returns trimmed input or default if user just presses enter.
    """
    default_part = f" [{default}]" if default is not None else ""
    pretty_print(f"{question}{default_part}: ", color=color, indent=2)
    user_input = input(" " * 4).strip()
    return user_input if user_input else default

def run_npm_command(command: str, cwd: Optional[str] = None, show_output: bool = True) -> bool:
    """
    Run an npm command and return True if successful.
    """
    if not shutil.which("npm"):
        pretty_print("npm is not installed or not in PATH", color="red")
        return False
    
    try:
        result = subprocess.run(
            f"npm {command}" if not command.startswith("npm ") else command,
            shell=True,
            cwd=cwd,
            check=True,
            capture_output=not show_output,
            text=True
        )
        if show_output and result.stdout:
            pretty_print(result.stdout, color="green")
        return True
    except subprocess.CalledProcessError as e:
        if show_output:
            pretty_print(f"Error running npm command: {e.stderr}", color="red")
        return False

def get_env_var_vals_from_user(vars_list: List[str]) -> Dict[str, str]:
    """
    Prompt user for values of environment variables.
    Returns a dictionary of variable names to values.
    """
    env_vars = {}
    for var in vars_list:
        value = prompt(f"Enter value for {var}", os.environ.get(var, ""))
        if value:
            env_vars[var] = value
    return env_vars

def update_path_envars(new_paths: List[str], system_wide: bool = False) -> bool:
    """
    Update PATH environment variable with new paths.
    On Windows, can update system-wide (requires admin).
    """
    path_sep = ";" if os.name == "nt" else ":"
    current_path = os.environ.get("PATH", "").split(path_sep)
    
    # Add new paths if not already present
    updated = False
    for path in new_paths:
        normalized_path = str(Path(path).resolve())
        if normalized_path not in current_path:
            current_path.insert(0, normalized_path)
            updated = True
    
    if not updated:
        return False
    
    new_path = path_sep.join(current_path)
    os.environ["PATH"] = new_path
    
    if system_wide and os.name == "nt":
        try:
            import winreg
            with winreg.OpenKey(
                winreg.HKEY_LOCAL_MACHINE,
                r"SYSTEM\CurrentControlSet\Control\Session Manager\Environment",
                0, winreg.KEY_ALL_ACCESS
            ) as key:
                winreg.SetValueEx(key, "Path", 0, winreg.REG_EXPAND_SZ, new_path)
            # Broadcast WM_SETTINGCHANGE to notify other processes
            import ctypes
            ctypes.windll.user32.SendMessageTimeoutW(
                0xFFFF, 0x001A, 0, "Environment", 0, 5000, 0
            )
            return True
        except Exception as e:
            pretty_print(f"Failed to update system PATH: {e}", color="yellow")
            return False
    elif system_wide:
        pretty_print("System-wide PATH updates on non-Windows require manual configuration", color="yellow")
    
    return True

def get_node_install_url(version: str = NODE_VERSION) -> Tuple[str, str]:
    """
    Get the appropriate Node.js download URL for the current platform.
    Returns (download_url, filename)
    """
    system = platform.system().lower()
    arch = platform.machine().lower()
    
    # Normalize architecture names
    if arch == "x86_64":
        arch = "x64"
    elif arch == "i386" or arch == "i686":
        arch = "x86"
    elif arch == "aarch64":
        arch = "arm64"
    
    if system == "windows":
        arch = "x64" if arch == "x86_64" else arch
        filename = f"node-v{version}-win-{arch}.zip"
    elif system == "darwin":
        # Apple Silicon or Intel
        if arch == "arm64":
            filename = f"node-v{version}-darwin-arm64.tar.gz"
        else:
            filename = f"node-v{version}-darwin-x64.tar.gz"
    else:  # linux
        filename = f"node-v{version}-linux-{arch}.tar.xz"
    
    return f"{NODE_DIST_URL}/v{version}/{filename}", filename

def install_nodejs(version: str = NODE_VERSION, install_dir: Optional[str] = None) -> bool:
    """
    Download and install Node.js for the current platform.
    Returns True if successful.
    """
    display_banner("Node.js Installation")
    
    # Determine install directory
    default_install_dir = {
        "windows": r"C:\Program Files\nodejs",
        "darwin": "/usr/local",
        "linux": "/usr/local"
    }.get(platform.system().lower(), ".")
    
    install_dir = install_dir or prompt(
        "Enter installation directory", 
        default_install_dir
    )
    
    if not install_dir:
        pretty_print("Installation directory is required", color="red")
        return False
    
    install_dir = Path(install_dir).expanduser().resolve()
    
    # Get download URL
    download_url, filename = get_node_install_url(version)
    pretty_print(f"Downloading Node.js {version} from {download_url}", color="blue")
    
    try:
        # Download the file
        response = requests.get(download_url, stream=True)
        response.raise_for_status()
        
        temp_file = Path(filename)
        with open(temp_file, "wb") as f:
            for chunk in response.iter_content(chunk_size=8192):
                f.write(chunk)
        
        pretty_print(f"Downloaded {temp_file}", color="green")
        
        # Extract the archive
        extract_dir = Path.cwd() / f"node-v{version}"
        if extract_dir.exists():
            shutil.rmtree(extract_dir)
        
        pretty_print(f"Extracting {temp_file}...", color="blue")
        
        if filename.endswith(".zip"):
            import zipfile
            with zipfile.ZipFile(temp_file) as zip_ref:
                zip_ref.extractall()
        elif filename.endswith(".tar.gz") or filename.endswith(".tar.xz"):
            import tarfile
            mode = "r:gz" if filename.endswith(".tar.gz") else "r:xz"
            with tarfile.open(temp_file, mode) as tar_ref:
                tar_ref.extractall()
        
        # Move files to install directory
        pretty_print(f"Installing to {install_dir}...", color="blue")
        
        if platform.system().lower() == "windows":
            # Windows zip contains a single directory with all files
            node_dir = extract_dir
            if not install_dir.exists():
                install_dir.mkdir(parents=True)
            
            for item in node_dir.iterdir():
                dest = install_dir / item.name
                if item.is_dir():
                    shutil.copytree(item, dest, dirs_exist_ok=True)
                else:
                    shutil.copy2(item, dest)
        else:
            # Unix-like systems: copy contents of the bin, include, lib, share directories
            src_dir = extract_dir
            for subdir in ["bin", "include", "lib", "share"]:
                src = src_dir / subdir
                if src.exists():
                    dest = install_dir / subdir
                    if dest.exists():
                        shutil.rmtree(dest)
                    shutil.copytree(src, dest)
        
        # Clean up
        temp_file.unlink()
        shutil.rmtree(extract_dir)
        
        # Update PATH
        bin_path = install_dir / "bin" if platform.system().lower() != "windows" else install_dir
        if str(bin_path) not in os.environ["PATH"]:
            update_path = prompt(
                f"Add {bin_path} to PATH?", 
                "yes", 
                "yellow"
            ).lower() in ("y", "yes")
            
            if update_path:
                update_path_envars([str(bin_path)], system_wide=False)
                pretty_print(f"Added {bin_path} to PATH", color="green")
        
        pretty_print(f"Node.js {version} installed successfully to {install_dir}", color="green")
        return True
    
    except Exception as e:
        pretty_print(f"Failed to install Node.js: {e}", color="red")
        return False

def main():
    """Main entry point for the script."""
    display_banner()
    
    # Check if Node.js is installed
    if not shutil.which("node"):
        pretty_print("Node.js is not installed", color="yellow")
        install = prompt("Would you like to install Node.js now?", "yes")
        if install.lower() in ("y", "yes"):
            version = prompt("Enter Node.js version to install", NODE_VERSION)
            install_nodejs(version)
    
    # Demo npm command
    if shutil.which("npm"):
        pretty_print("Running npm --version to verify installation:", color="blue")
        run_npm_command("--version")
    else:
        pretty_print("npm not found in PATH", color="red")
    
    # Demo environment variable collection
    pretty_print("\nExample: Collect environment variables", color="magenta")
    env_vars = get_env_var_vals_from_user(["API_KEY", "DATABASE_URL"])
    if env_vars:
        pretty_print("Collected environment variables:", color="green")
        for k, v in env_vars.items():
            pretty_print(f"{k}={v}", indent=4)

if __name__ == "__main__":
    main()
