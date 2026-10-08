import shutil
from dexweb import dexgen
dex = dexgen.Dexgen()

# Copy the new website in gen/ to docs/, the folder that the site is published from.
# Files in docs/ that are not in gen/ stay.
shutil.copytree('gen', 'docs', dirs_exist_ok=True)
print('gen/ copied to docs/')
