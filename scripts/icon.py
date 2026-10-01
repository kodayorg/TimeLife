"""Package the approved TimeLife PNG exports as a Windows icon without changing them."""
from pathlib import Path
import shutil
import struct

project = Path(__file__).resolve().parent.parent
source = project / 'output' / 'timelife' / 'icons'
out = project / 'src' / 'assets'
sizes = (16, 24, 32, 48, 64, 96, 128, 192, 256)
frames = [(size, (source / f'timelife-{size}.png').read_bytes()) for size in sizes]
offset = 6 + 16 * len(frames)
directory = bytearray(struct.pack('<HHH', 0, 1, len(frames)))
for size, png in frames:
    directory.extend(struct.pack('<BBBBHHII', size % 256, size % 256, 0, 0, 1, 32, len(png), offset))
    offset += len(png)
(out / 'icon.ico').write_bytes(directory + b''.join(png for _, png in frames))
shutil.copyfile(source / 'timelife-512.png', out / 'icon.png')
print(f'TimeLife icon: {len(frames)} PNG frames, transparent background preserved.')
