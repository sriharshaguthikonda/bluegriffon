#!/usr/bin/env python3
"""
Script to update icons in all branches with the inverted versions from current branch.
"""

import subprocess
import os
from pathlib import Path

# List of icon files to update (from our current branch)
ICON_FILES = [
    "app/bluegriffon-os2.ico",
    "branding/document.ico",
    "themes/mac/classic/bluegriffon.ico",
    "themes/win.old/classic/bluegriffon.ico",
    "branding/default16.png",
    "branding/default22.png",
    "branding/default24.png",
    "branding/default32.png",
    "branding/default48.png",
    "branding/default256.png",
    "branding/mozicon128.png",
    "app/icons/default16.png",
    "app/icons/default32.png",
    "app/icons/default48.png",
    "app/icons/default50.png",
]

# Branches to exclude (current branch, special branches)
EXCLUDE_BRANCHES = {
    "exp/python3-migration",  # Current branch
    "HEAD",
    "remotes/origin/HEAD",
}

def run_command(cmd, cwd=None):
    """Run a command and return output."""
    try:
        result = subprocess.run(cmd, shell=True, capture_output=True, text=True, cwd=cwd)
        return result.returncode == 0, result.stdout, result.stderr
    except Exception as e:
        return False, "", str(e)

def get_all_branches():
    """Get all local and remote branches."""
    success, stdout, stderr = run_command("git branch -a")
    if not success:
        print(f"Error getting branches: {stderr}")
        return []
    
    branches = []
    for line in stdout.split('\n'):
        line = line.strip()
        if line:
            # Remove leading * and remotes/origin/
            branch = line.replace('* ', '').replace('remotes/origin/', '')
            if branch not in EXCLUDE_BRANCHES and not branch.startswith('remotes/upstream'):
                branches.append(branch)
    
    return sorted(set(branches))

def switch_to_branch(branch):
    """Switch to a branch, creating it from remote if needed."""
    print(f"Switching to branch: {branch}")
    
    # Check if branch exists locally
    success, stdout, stderr = run_command(f"git rev-parse --verify {branch}")
    if success:
        # Branch exists locally, just checkout
        success, stdout, stderr = run_command(f"git checkout {branch}")
    else:
        # Branch doesn't exist locally, create from remote
        remote_branch = f"origin/{branch}"
        success, stdout, stderr = run_command(f"git checkout -b {branch} {remote_branch}")
    
    if success:
        print(f"✓ Switched to {branch}")
        return True
    else:
        print(f"✗ Failed to switch to {branch}: {stderr}")
        return False

def update_icons_in_branch(branch):
    """Update icons in the current branch."""
    print(f"\n=== Updating icons in branch: {branch} ===")
    
    # Pull latest changes for this branch
    success, stdout, stderr = run_command("git pull origin " + branch)
    if not success:
        print(f"Warning: Could not pull latest changes for {branch}: {stderr}")
    
    updated_files = []
    
    for icon_file in ICON_FILES:
        source_file = icon_file
        target_file = icon_file
        
        if os.path.exists(source_file):
            # Check if file exists in target branch
            if os.path.exists(target_file):
                # Copy the inverted icon
                try:
                    with open(source_file, 'rb') as src:
                        content = src.read()
                    
                    with open(target_file, 'wb') as dst:
                        dst.write(content)
                    
                    updated_files.append(target_file)
                    print(f"✓ Updated {target_file}")
                except Exception as e:
                    print(f"✗ Failed to update {target_file}: {e}")
            else:
                print(f"- Skipped {target_file} (doesn't exist in branch)")
        else:
            print(f"- Skipped {target_file} (source doesn't exist)")
    
    if updated_files:
        # Stage the updated files
        for file in updated_files:
            success, stdout, stderr = run_command(f"git add \"{file}\"")
            if not success:
                print(f"✗ Failed to stage {file}: {stderr}")
        
        # Commit the changes
        if len(updated_files) > 0:
            commit_msg = f"Update icons with inverted versions ({len(updated_files)} files)"
            success, stdout, stderr = run_command(f'git commit -m "{commit_msg}"')
            if success:
                print(f"✓ Committed icon updates in {branch}")
                return True
            else:
                print(f"✗ Failed to commit in {branch}: {stderr}")
    else:
        print(f"- No icons to update in {branch}")
    
    return False

def main():
    """Main function to update icons in all branches."""
    print("Starting icon update process for all branches...")
    print("=" * 60)
    
    # Get current branch to return to later
    success, stdout, stderr = run_command("git branch --show-current")
    current_branch = stdout.strip() if success else "exp/python3-migration"
    
    # Get all branches
    branches = get_all_branches()
    print(f"Found {len(branches)} branches to update")
    
    updated_branches = []
    failed_branches = []
    
    for branch in branches:
        if switch_to_branch(branch):
            if update_icons_in_branch(branch):
                updated_branches.append(branch)
            else:
                failed_branches.append(branch)
        else:
            failed_branches.append(branch)
    
    # Return to original branch
    print(f"\n=== Returning to original branch: {current_branch} ===")
    switch_to_branch(current_branch)
    
    # Summary
    print("\n" + "=" * 60)
    print("UPDATE SUMMARY:")
    print(f"✓ Successfully updated: {len(updated_branches)} branches")
    if updated_branches:
        for branch in updated_branches:
            print(f"  - {branch}")
    
    print(f"✗ Failed to update: {len(failed_branches)} branches")
    if failed_branches:
        for branch in failed_branches:
            print(f"  - {branch}")
    
    if updated_branches:
        print(f"\nNext steps:")
        print(f"1. Review the changes in updated branches")
        print(f"2. Push updated branches:")
        for branch in updated_branches:
            print(f"   git push origin {branch}")

if __name__ == "__main__":
    main()
