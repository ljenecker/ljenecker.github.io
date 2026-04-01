#!/usr/bin/env python3
"""
IEGF Image Generator Agent
Generates brand-consistent images using Google Gemini's image generation.

Usage:
    # Generate from a prompt string
    python tools/generate-image.py --prompt "A young African entrepreneur..." --output assets/media/hero.png

    # Generate from image-prompts.md by section number
    python tools/generate-image.py --from-guide 2 --output assets/media/map/2.png

    # Generate all images from the guide
    python tools/generate-image.py --from-guide all --output-dir assets/media/map/

    # Custom size (default: 1200x800)
    python tools/generate-image.py --prompt "..." --output out.png --size 1920x800

    # Dry run (show prompt without generating)
    python tools/generate-image.py --from-guide 3 --dry-run

Requires:
    - GEMINI_API_KEY environment variable
    - pip install google-genai Pillow  (or use .venv)
"""

import argparse
import os
import re
import sys
from io import BytesIO
from pathlib import Path

# Load .env from project root
_env_path = Path(__file__).resolve().parent.parent / ".env"
if _env_path.exists():
    for line in _env_path.read_text().splitlines():
        line = line.strip()
        if line and not line.startswith("#") and "=" in line:
            key, _, value = line.partition("=")
            os.environ.setdefault(key.strip(), value.strip())

try:
    import PIL.Image
    from google import genai
except ImportError:
    print("Missing dependencies. Run:")
    print("  source .venv/bin/activate && pip install google-genai Pillow")
    sys.exit(1)


# IEGF Brand Kit — injected into every prompt
BRAND_CONTEXT = """
IMPORTANT STYLE REQUIREMENTS:
- Color palette: deep navy blue (#052a64), fresh green (#4ba755), light grey (#d9d9d9)
- Tone: professional, warm, people-centred, African-focused development organization
- Style: clean corporate photography with warm natural lighting, diverse African subjects, hopeful and empowering mood
- No text, no logos, no watermarks in the image
- High resolution, suitable for website use
"""


def parse_prompts_guide(guide_path):
    """Parse image-prompts.md and return a dict of section_number -> {title, size, use, prompt}."""
    content = Path(guide_path).read_text()
    sections = {}

    pattern = re.compile(
        r"### (\d+)\.\s+(.+?)\n\n"
        r"\*\*Size\*\*:\s*(.+?)\n"
        r"\*\*Use\*\*:\s*(.+?)\n\n"
        r"> (.+?)(?:\n\n---|\n\n##|\Z)",
        re.DOTALL,
    )

    for match in pattern.finditer(content):
        num = int(match.group(1))
        sections[num] = {
            "title": match.group(2).strip(),
            "size": match.group(3).strip(),
            "use": match.group(4).strip(),
            "prompt": match.group(5).strip(),
        }

    return sections


def parse_size(size_str):
    """Parse a size string like '1920x800' or '1920 x 800px' into (width, height)."""
    match = re.search(r"(\d+)\s*[x\u00d7]\s*(\d+)", size_str)
    if match:
        return int(match.group(1)), int(match.group(2))
    return 1200, 800


def _crop_to_fill(image, target_size):
    """Scale image to cover target_size, then center-crop. No stretching."""
    tw, th = target_size
    iw, ih = image.size
    target_ratio = tw / th
    image_ratio = iw / ih

    if image_ratio > target_ratio:
        # Image is wider than target — scale by height, crop width
        new_h = th
        new_w = int(iw * (th / ih))
    else:
        # Image is taller than target — scale by width, crop height
        new_w = tw
        new_h = int(ih * (tw / iw))

    image = image.resize((new_w, new_h), PIL.Image.LANCZOS)

    left = (new_w - tw) // 2
    top = (new_h - th) // 2
    return image.crop((left, top, left + tw, top + th))


def generate_image(prompt, output_path, size=None):
    """Generate an image using Gemini and save it."""
    api_key = os.environ.get("GEMINI_API_KEY")
    if not api_key:
        print("Error: GEMINI_API_KEY environment variable is not set.")
        print("  export GEMINI_API_KEY='your-key-here'")
        sys.exit(1)

    client = genai.Client(api_key=api_key)

    full_prompt = f"{prompt}\n\n{BRAND_CONTEXT}"

    print(f"Generating image...")
    print(f"  Prompt: {prompt[:100]}...")
    print(f"  Output: {output_path}")
    if size:
        print(f"  Target: {size[0]}x{size[1]} (center-crop)")

    response = client.models.generate_content(
        model="gemini-2.5-flash-image",
        contents=[full_prompt],
    )

    image_saved = False
    for part in response.candidates[0].content.parts:
        if part.text is not None:
            print(f"  Model response: {part.text}")
        elif part.inline_data is not None:
            image = PIL.Image.open(BytesIO(part.inline_data.data))
            print(f"  Raw size: {image.size[0]}x{image.size[1]}")

            if size:
                image = _crop_to_fill(image, size)

            output = Path(output_path)
            output.parent.mkdir(parents=True, exist_ok=True)
            image.save(str(output))
            print(f"  Saved: {output} ({image.size[0]}x{image.size[1]})")
            image_saved = True

    if not image_saved:
        print("  Warning: No image was returned by the model.")
        return False

    return True


def main():
    parser = argparse.ArgumentParser(
        description="IEGF Image Generator — generate brand-consistent images with Gemini"
    )

    source = parser.add_mutually_exclusive_group(required=True)
    source.add_argument(
        "--prompt",
        help="Direct prompt text for image generation",
    )
    source.add_argument(
        "--from-guide",
        help="Section number, range, or 'all' from image-prompts.md (e.g. 2, 8-13, or 'all')",
    )

    parser.add_argument(
        "--output", "-o",
        help="Output file path (required with --prompt or single --from-guide)",
    )
    parser.add_argument(
        "--output-dir",
        help="Output directory for --from-guide all (files named by section number)",
    )
    parser.add_argument(
        "--size",
        help="Image size as WIDTHxHEIGHT (e.g. 1920x800). Overrides guide size.",
    )
    parser.add_argument(
        "--guide",
        default="image-prompts.md",
        help="Path to image prompts guide (default: image-prompts.md)",
    )
    parser.add_argument(
        "--skip-existing",
        action="store_true",
        help="Skip generation if the output file already exists",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Show the prompt that would be sent without generating",
    )

    args = parser.parse_args()

    # Parse size override
    size_override = None
    if args.size:
        size_override = parse_size(args.size)

    if args.prompt:
        if not args.output:
            parser.error("--output is required with --prompt")
        size = size_override or (1200, 800)
        if args.dry_run:
            print(f"[DRY RUN] Would generate:\n  Prompt: {args.prompt}\n  Size: {size}\n  Output: {args.output}")
            return
        generate_image(args.prompt, args.output, size)

    elif args.from_guide:
        guide_path = Path(args.guide)
        if not guide_path.exists():
            print(f"Error: Guide file not found: {guide_path}")
            sys.exit(1)

        sections = parse_prompts_guide(guide_path)
        if not sections:
            print(f"Error: No image prompts found in {guide_path}")
            sys.exit(1)

        # Determine which sections to generate
        guide_arg = args.from_guide.lower()
        if guide_arg == "all":
            selected = sorted(sections.keys())
        elif "-" in args.from_guide and not args.from_guide.startswith("-"):
            start, end = args.from_guide.split("-", 1)
            selected = [n for n in sorted(sections.keys()) if int(start) <= n <= int(end)]
        else:
            selected = [int(args.from_guide)]

        # Validate
        for num in selected:
            if num not in sections:
                print(f"Error: Section {num} not found in guide. Available: {sorted(sections.keys())}")
                sys.exit(1)

        if len(selected) > 1:
            output_dir = Path(args.output_dir or "assets/media/generated")
            print(f"Generating {len(selected)} images (sections {selected[0]}-{selected[-1]}) to {output_dir}/\n")

            for num in selected:
                section = sections[num]
                size = size_override or parse_size(section["size"])
                output = output_dir / f"{num}.png"

                if args.skip_existing and output.exists():
                    print(f"  Skipping section {num}: {section['title']} (already exists)")
                    continue

                if args.dry_run:
                    print(f"[DRY RUN] Section {num}: {section['title']}")
                    print(f"  Size: {size}")
                    print(f"  Output: {output}")
                    print(f"  Prompt: {section['prompt'][:120]}...\n")
                    continue

                print(f"\n--- Section {num}: {section['title']} ---")
                generate_image(section["prompt"], str(output), size)

        else:
            num = selected[0]
            section = sections[num]
            size = size_override or parse_size(section["size"])
            output = args.output or f"assets/media/generated/{num}.png"

            if args.skip_existing and Path(output).exists():
                print(f"  Skipping section {num}: {section['title']} (already exists)")
                return

            if args.dry_run:
                print(f"[DRY RUN] Section {num}: {section['title']}")
                print(f"  Size: {size}")
                print(f"  Use: {section['use']}")
                print(f"  Output: {output}")
                print(f"  Prompt: {section['prompt']}")
                return

            print(f"Section {num}: {section['title']}")
            generate_image(section["prompt"], output, size)


if __name__ == "__main__":
    main()
