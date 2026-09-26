import io
from PIL import Image
from torchvision import transforms


def bytes_to_pil_image(file_bytes: bytes) -> Image.Image:
    """Decode raw upload bytes into an RGB PIL image."""
    image = Image.open(io.BytesIO(file_bytes))
    return image.convert("RGB")


def build_transform(img_size: int, mean: list, std: list) -> transforms.Compose:
    """Build the preprocessing pipeline for a given model.

    Keep this in sync with whatever transform was used at training time
    (same resize size and normalization stats), or predictions will be
    unreliable even though nothing errors out.
    """
    return transforms.Compose([
        transforms.Resize((img_size, img_size)),
        transforms.ToTensor(),
        transforms.Normalize(mean=mean, std=std),
    ])