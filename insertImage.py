import os
import re
from pathlib import Path

def insertar_imagen_automatico():
    print("\n--- Insertar Nueva Imagen Automáticamente ---\n")
    
    # Solicitar datos
    url_imagen = input("URL completa de la imagen: ").strip()
    while not (url_imagen.startswith(('http://', 'https://')) and any(url_imagen.lower().endswith(ext) for ext in ['.png', '.jpg', '.jpeg', '.gif'])):
        print("URL debe comenzar con http:// o https:// y terminar con .png, .jpg, .jpeg o .gif")
        url_imagen = input("URL de la imagen: ").strip()
    
    titulo_imagen = input("Título de la imagen: ").strip()
    while not titulo_imagen:
        print("El título no puede estar vacío")
        titulo_imagen = input("Título de la imagen: ").strip()
    
    # Seleccionar ventana
    print("\nSelecciona la ventana donde añadir la imagen:")
    print("1. Gallery")
    print("2. Art")
    opcion = input("Opción (1-2): ").strip()
    
    while opcion not in ['1', '2']:
        print("Opción no válida")
        opcion = input("Opción (1-2): ").strip()
    
    ventana = "galleryWindow" if opcion == '1' else "artWindow"
    
    # Buscar archivo HTML
    html_files = [f for f in os.listdir() if f.endswith('.html')]
    if not html_files:
        print("\nNo se encontraron archivos HTML en el directorio actual.")
        return
    
    print("\nArchivos HTML encontrados:")
    for i, file in enumerate(html_files, 1):
        print(f"{i}. {file}")
    
    file_choice = input(f"\nSelecciona el archivo a modificar (1-{len(html_files)}): ").strip()
    while not file_choice.isdigit() or int(file_choice) not in range(1, len(html_files)+1):
        print("Opción no válida")
        file_choice = input(f"Selecciona el archivo a modificar (1-{len(html_files)}): ").strip()
    
    html_file = html_files[int(file_choice)-1]
    
    # Leer el archivo HTML
    with open(html_file, 'r', encoding='utf-8') as file:
        content = file.read()
    
    # Crear el código a insertar
    nuevo_thumbnail = f"""
        <div class="thumbnail" onclick="openImageWindow('{url_imagen}', '{titulo_imagen}')">
          <img src="{url_imagen}" alt="{titulo_imagen}">
          <div>{titulo_imagen}</div>
        </div>"""
    
    # Encontrar y actualizar la sección correspondiente
    pattern = re.compile(f'(<div id="{ventana}".*?<div class="thumbnail-grid">.*?)(<div class="thumbnail".*?</div>\s*</div>)', re.DOTALL)
    
    if not pattern.search(content):
        print(f"\nError: No se encontró la sección {ventana} con thumbnail-grid en el archivo.")
        return
    
    # Insertar el nuevo thumbnail
    new_content = pattern.sub(r'\1' + nuevo_thumbnail + r'\2', content)
    
    # Crear backup
    backup_file = f"{Path(html_file).stem}_backup{Path(html_file).suffix}"
    with open(backup_file, 'w', encoding='utf-8') as file:
        file.write(content)
    
    # Escribir el nuevo contenido
    with open(html_file, 'w', encoding='utf-8') as file:
        file.write(new_content)
    
    print(f"\n¡Imagen insertada correctamente en {ventana}!")
    print(f"Se creó un backup del archivo original como: {backup_file}")
    print(f"\nPuedes abrir {html_file} para ver los cambios.")

if __name__ == "__main__":
    insertar_imagen_automatico()
    input("\nPresiona Enter para salir...")