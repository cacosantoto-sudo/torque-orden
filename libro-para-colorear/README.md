# Libro para colorear: autos de carrera

`Autos de carrera para pintar.pdf` es un libro para colorear en A4 horizontal (32 páginas) con 23 autos reales:
autos deportivos argentinos, autos del mundo, el TC de hoy y campeones históricos del TC. Al final hay créditos y un diploma.

Cada dibujo es un boceto a lápiz calcado de una foto con licencia libre de Wikimedia Commons. La página de créditos lista el autor y la licencia de cada foto.

## Cómo regenerarlo

En `generador/` están los scripts:

1. `pip install opencv-python-headless "rembg[cpu]" reportlab pillow scikit-image` y `pip install torch --index-url https://download.pytorch.org/whl/cpu`
   Bajar el modelo de bocetos `sk_model2.pth` de https://huggingface.co/lllyasviel/Annotators (ajustar la ruta `MODELS` en `nnline.py`).
2. Bajar las fuentes Baloo 2 y Nunito (Google Fonts) a `generador/fonts/`.
3. `python3 build_art.py` baja las fotos de `picks.json`, quita el fondo y genera los bocetos en `art/` (`la3.py` + `nnline.py`). `regen3.py` vuelve a dibujar sin bajar nada.
4. `python3 build_pdf.py libro.pdf` arma el PDF.

Los textos (año, piloto, dato curioso, bandera) están en `content.py`.
