#!/usr/bin/env python3
"""
Script to invert colors of BlueGriffon icons for dev build distinction.
Handles ICO and PNG files.
"""

import os
import shutil
from PIL import Image
import numpy as np
from tqdm import tqdm

def invert_image_colors(image_path):
    """Invert colors of an image while preserving transparency."""
    try:
        img = Image.open(image_path)
        
        # Convert to RGBA if not already
        if img.mode != 'RGBA':
            img = img.convert('RGBA')
        
        # Get image data as numpy array
        data = np.array(img)
        
        # Separate RGB and Alpha channels
        rgb = data[:, :, :3]
        alpha = data[:, :, 3]
        
        # Invert RGB channels
        rgb_inverted = 255 - rgb
        
        # Combine back with original alpha
        data[:, :, :3] = rgb_inverted
        data[:, :, 3] = alpha
        
        # Convert back to PIL Image
        inverted_img = Image.fromarray(data, 'RGBA')
        
        return inverted_img
    except Exception as e:
        print(f"Error processing {image_path}: {e}")
        return None

def process_file(file_path, backup=True):
    """Process a single file - invert colors and save."""
    try:
        if backup:
            # Create backup
            backup_path = f"{file_path}.backup"
            if not os.path.exists(backup_path):
                shutil.copy2(file_path, backup_path)
                print(f"Created backup: {backup_path}")
        
        # Process based on file extension
        if file_path.lower().endswith('.ico'):
            # For ICO files, convert to PNG, invert, then save as ICO
            img = Image.open(file_path)
            
            # Get the largest size from ICO
            size = img.size if hasattr(img, 'size') else (32, 32)
            
            # Convert to PNG temporarily
            temp_png = file_path.replace('.ico', '_temp.png')
            img.save(temp_png)
            
            # Invert the PNG
            inverted_img = invert_image_colors(temp_png)
            
            if inverted_img:
                # Save back as ICO
                inverted_img.save(file_path, format='ICO', sizes=[size])
                print(f"Inverted: {file_path}")
                
                # Clean up temp file
                if os.path.exists(temp_png):
                    os.remove(temp_png)
                return True
                
        elif file_path.lower().endswith('.png'):
            inverted_img = invert_image_colors(file_path)
            if inverted_img:
                inverted_img.save(file_path)
                print(f"Inverted: {file_path}")
                return True
        
        return False
        
    except Exception as e:
        print(f"Error processing {file_path}: {e}")
        return False

def main():
    """Main function to invert icons."""
    # Icons to invert (excluding already inverted ones)
    icons_to_invert = [
        # OS/2 variants
        "branding/bluegriffon-os2.ico",
        "branding/document-os2.ico", 
        "app/bluegriffon-os2.ico",
        
        # Document icons
        "branding/document.ico",
        
        # Theme variants
        "themes/mac/classic/bluegriffon.ico",
        "themes/win.old/classic/bluegriffon.ico",
        
        # Default size icons
        "branding/default16.png",
        "branding/default22.png",
        "branding/default24.png", 
        "branding/default32.png",
        "branding/default48.png",
        "branding/default256.png",
        "branding/mozicon128.png",
        
        # Additional app icons not yet inverted
        "app/icons/default16.png",
        "app/icons/default32.png", 
        "app/icons/default48.png",
        "app/icons/default50.png",
    ]
    
    print("Starting icon inversion process...")
    print("=" * 50)
    
    success_count = 0
    total_count = len(icons_to_invert)
    
    for icon_path in tqdm(icons_to_invert, desc="Inverting icons"):
        if os.path.exists(icon_path):
            if process_file(icon_path):
                success_count += 1
        else:
            print(f"File not found: {icon_path}")
    
    print("=" * 50)
    print(f"Completed: {success_count}/{total_count} icons processed successfully")
    
    if success_count > 0:
        print("\nIcons have been inverted! You can now:")
        print("1. Review the changes")
        print("2. Commit the inverted icons")
        print("3. Test the application")

if __name__ == "__main__":
    main()
