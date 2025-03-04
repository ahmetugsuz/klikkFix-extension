from PIL import Image  # ✅ Correct import

# Load your original image (Make sure it's large enough, e.g., 512x512)
original = Image.open("Icons/icon.png")

# Define required sizes
sizes = [16, 32, 48, 128]

# Save resized images
for size in sizes:
    resized = original.resize((size, size))  # Use ANTIALIAS for better quality
    resized.save(f"Icons/icon{size}.png")
