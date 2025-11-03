#!/usr/bin/env python3
"""
Standardize hover styles and text colors across all CRM frontend pages.

This script applies consistent styling patterns:
1. Hover styles: hover:bg-green-50 dark:hover:bg-green-900/20
2. Text colors: text-gray-900 dark:text-slate-100 (primary), text-gray-600 dark:text-slate-400 (secondary)
3. Transition: transition-colors duration-200
"""

import os
import re
import sys

def standardize_hover_styles(content):
    """Standardize hover background and text colors."""
    
    # Pattern 1: hover:bg-gray-* → hover:bg-green-50 dark:hover:bg-green-900/20
    # But preserve specific colors like hover:bg-red-*, hover:bg-yellow-*
    content = re.sub(
        r'hover:bg-gray-(\d+)(?!\s*dark:hover:bg-)',
        r'hover:bg-green-50 dark:hover:bg-green-900/20',
        content
    )
    
    # Pattern 2: hover:text-gray-* → hover:text-green-700 dark:hover:text-green-300
    content = re.sub(
        r'hover:text-gray-(\d+)(?!\s*dark:hover:text-)',
        r'hover:text-green-700 dark:hover:text-green-300',
        content
    )
    
    # Pattern 3: Add transition-colors duration-200 if not present
    # Find className attributes that have hover: but no transition
    def add_transition(match):
        classes = match.group(1)
        if 'hover:' in classes and 'transition' not in classes:
            # Add transition-colors duration-200 at the end
            return f'className="{classes} transition-colors duration-200"'
        return match.group(0)
    
    content = re.sub(
        r'className="([^"]*hover:[^"]*)"',
        add_transition,
        content
    )
    
    return content

def standardize_text_colors(content):
    """Standardize text colors to use consistent primary/secondary patterns."""
    
    # Primary text: text-black or text-gray-900 → text-gray-900 dark:text-slate-100
    content = re.sub(
        r'\btext-black\b(?!\s*dark:text-)',
        r'text-gray-900 dark:text-slate-100',
        content
    )
    
    content = re.sub(
        r'\btext-gray-900\b(?!\s*dark:text-)',
        r'text-gray-900 dark:text-slate-100',
        content
    )
    
    # Secondary text: text-gray-600 → text-gray-600 dark:text-slate-400
    content = re.sub(
        r'\btext-gray-600\b(?!\s*dark:text-)',
        r'text-gray-600 dark:text-slate-400',
        content
    )
    
    # Tertiary text: text-gray-500 → text-gray-500 dark:text-slate-500
    content = re.sub(
        r'\btext-gray-500\b(?!\s*dark:text-)',
        r'text-gray-500 dark:text-slate-500',
        content
    )
    
    # Muted text: text-gray-400 → text-gray-400 dark:text-slate-600
    content = re.sub(
        r'\btext-gray-400\b(?!\s*dark:text-)',
        r'text-gray-400 dark:text-slate-600',
        content
    )
    
    return content

def standardize_border_colors(content):
    """Standardize border colors for dark mode."""
    
    # border-gray-200 → border-gray-200 dark:border-slate-700
    content = re.sub(
        r'\bborder-gray-200\b(?!\s*dark:border-)',
        r'border-gray-200 dark:border-slate-700',
        content
    )
    
    # border-gray-300 → border-gray-300 dark:border-slate-600
    content = re.sub(
        r'\bborder-gray-300\b(?!\s*dark:border-)',
        r'border-gray-300 dark:border-slate-600',
        content
    )
    
    return content

def process_file(filepath):
    """Process a single file to standardize styling."""
    try:
        with open(filepath, 'r', encoding='utf-8') as f:
            content = f.read()
        
        original_content = content
        
        # Apply all standardizations
        content = standardize_hover_styles(content)
        content = standardize_text_colors(content)
        content = standardize_border_colors(content)
        
        # Only write if content changed
        if content != original_content:
            with open(filepath, 'w', encoding='utf-8') as f:
                f.write(content)
            return True
        return False
    except Exception as e:
        print(f"Error processing {filepath}: {e}")
        return False

def main():
    if len(sys.argv) < 2:
        print("Usage: python3 standardize_styling.py <directory>")
        sys.exit(1)
    
    directory = sys.argv[1]
    
    if not os.path.exists(directory):
        print(f"Directory not found: {directory}")
        sys.exit(1)
    
    print(f"Standardizing styling in: {directory}")
    print("=" * 60)
    
    updated_count = 0
    total_count = 0
    
    # Process all .tsx files
    for root, dirs, files in os.walk(directory):
        # Skip node_modules and dist directories
        dirs[:] = [d for d in dirs if d not in ['node_modules', 'dist', '.git']]
        
        for file in files:
            if file.endswith('.tsx'):
                filepath = os.path.join(root, file)
                total_count += 1
                
                if process_file(filepath):
                    updated_count += 1
                    print(f"✓ Updated: {filepath}")
    
    print("=" * 60)
    print(f"Processed {total_count} files")
    print(f"Updated {updated_count} files")
    print("✅ Styling standardization complete!")

if __name__ == '__main__':
    main()

