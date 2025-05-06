// Elementos y estado global
const startMenu = document.getElementById('startMenu');
const windows = {
    about: document.getElementById('aboutWindow'),
    diary: document.getElementById('diaryWindow'),
    gallery: document.getElementById('galleryWindow'),
    art: document.getElementById('artWindow'),
    music: document.getElementById('musicWindow')

};
let windowCounter = 0;
let lastWindowPosition = { x: 100, y: 100 };
let offsetX, offsetY, isDragging = false, currentWindow;

// Funciones de utilidad
const toggleDisplay = (element, displayType = 'flex') => {
    element.style.display = (element.style.display === displayType) ? 'none' : displayType;
};

const toggleStartMenu = () => toggleDisplay(startMenu);

const updateLastWindowPosition = (offsetX = 30, offsetY = 30) => {
    lastWindowPosition.x += offsetX;
    lastWindowPosition.y += offsetY;
    
    if (lastWindowPosition.y > window.innerHeight * 0.7 || 
        lastWindowPosition.x > window.innerWidth * 0.7) {
        lastWindowPosition = { x: 100, y: 100 };
    }
};

const centerWindow = (windowElement) => {
    const windowWidth = parseInt(windowElement.style.width) || 480;
    const windowHeight = parseInt(windowElement.style.height) || 320;
    
    windowElement.style.left = `${(window.innerWidth - windowWidth) / 2}px`;
    windowElement.style.top = `${(window.innerHeight - windowHeight) / 2}px`;
    
    lastWindowPosition = { 
        x: (window.innerWidth - windowWidth) / 2 + 30, 
        y: (window.innerHeight - windowHeight) / 2 + 30 
    };
};

// Gestión de ventanas
const positionWindow = (windowElement, initialPosition = false) => {
    if (initialPosition) return; // No reposiciona si es la carga inicial
    
    const anyWindowVisible = Array.from(document.querySelectorAll('.window')).some(
        win => win.style.display === 'block' && win !== windowElement
    );
    
    if (anyWindowVisible) {
        windowElement.style.left = `${lastWindowPosition.x}px`;
        windowElement.style.top = `${lastWindowPosition.y}px`;
        updateLastWindowPosition();
    } else {
        centerWindow(windowElement);
    }
};
// const openMusicPlayer = (forcePosition = false) => {
//     const windowId = 'musicWindow';
//     let window = document.getElementById(windowId);
    
//     if (!window) {
//         window = document.createElement('div');
//         window.id = windowId;
//         window.className = 'window';
//         window.style.width = '500px';
//         window.style.height = '350px';
//         window.innerHTML = `
//             <div class="title-bar" onmousedown="startDrag(event, this.parentElement)">
//                 <span>✰ Music Player ✰</span>
//                 <button class="close-button" onclick="closeWindow('${windowId}')">×</button>
//             </div>
//             <div class="notepad-body" style="padding: 0; height: calc(100% - 30px);">
//                 <iframe src="musicPlayer/player.html" style="width: 100%; height: 100%; border: none;"></iframe>
//             </div>
//         `;
//         document.body.appendChild(window);
//         windows.music = window;
//     }

//     if (forcePosition) {
//         window.style.left = '10px';
//         window.style.top = '10px';
//     }

//     openWindow(windowId);
// };


const openWindow = (windowId, options = {}) => {
    const window = windows[windowId] || document.getElementById(windowId);
    if (!window) return;
    
    if (options.forceSize) {
        window.style.width = options.forceSize.width;
        window.style.height = options.forceSize.height;
    }
    
    // Solo aplica posicionamiento relativo si no es la carga inicial
    positionWindow(window, options.initialPosition);
    window.style.display = 'block';
    startMenu.style.display = 'none';
    
    if (windowId === 'diary') cargarBlog();
};

const closeWindow = (id) => {
    const window = typeof id === 'string' ? document.getElementById(id) : id;
    if (window) window.style.display = 'none';
};

// Funciones específicas de ventanas
const openImageWindow = (src, title) => {
    windowCounter++;
    const windowId = `imageWindow-${windowCounter}`;
    
    const newWindow = document.createElement('div');
    newWindow.id = windowId;
    newWindow.className = 'window';
    newWindow.style.display = 'block';
    
    const img = new Image();
    img.src = src;
    
    img.onload = function() {
        const maxHeight = (window.innerHeight * 0.8) - 30;
        const maxWidth = (window.innerWidth * 0.8);
        const imgRatio = img.width / img.height;
        
        // Calcular dimensiones manteniendo relación de aspecto
        let imgWidth = img.width;
        let imgHeight = img.height;
        
        if (imgWidth > maxWidth) {
            imgWidth = maxWidth;
            imgHeight = imgWidth / imgRatio;
        }
        
        if (imgHeight > maxHeight) {
            imgHeight = maxHeight;
            imgWidth = imgHeight * imgRatio;
        }
        
        // Asegurarse de que la ventana no sea demasiado pequeña
        const minSize = 300;
        if (imgWidth < minSize) imgWidth = minSize;
        if (imgHeight < minSize) imgHeight = minSize;
        
        newWindow.style.width = `${imgWidth}px`;
        newWindow.style.height = `${imgHeight + 30}px`;
        
        // Posicionar la ventana para que sea completamente visible
        const left = Math.max(10, (window.innerWidth - imgWidth) / 2);
        const top = Math.max(10, (window.innerHeight - imgHeight - 30) / 2);
        
        newWindow.style.left = `${left}px`;
        newWindow.style.top = `${top}px`;
        
        newWindow.innerHTML = `
            <div class="title-bar" onmousedown="startDrag(event, this.parentElement)">
                <span>✰ ${title} ✰</span>
                <button class="close-button" onclick="this.parentElement.parentElement.style.display = 'none'">×</button>
            </div>
            <div class="image-container">
                <img src="${src}" alt="${title}">
            </div>
        `;
        
        document.body.appendChild(newWindow);
    };
};

// Funciones de arrastre
const startDrag = (e, element) => {
    isDragging = true;
    currentWindow = element;
    offsetX = e.clientX - element.offsetLeft;
    offsetY = e.clientY - element.offsetTop;
    document.addEventListener('mousemove', drag);
    document.addEventListener('mouseup', stopDrag);
};

const drag = (e) => {
    if (isDragging && currentWindow) {
        currentWindow.style.left = (e.clientX - offsetX) + 'px';
        currentWindow.style.top = (e.clientY - offsetY) + 'px';
    }
};

const stopDrag = () => {
    isDragging = false;
    document.removeEventListener('mousemove', drag);
    document.removeEventListener('mouseup', stopDrag);
};

// Función para procesar el contenido y mantener las imágenes seguras
const processContent = (content) => {
    // Convertir imágenes HTTP a HTTPS para mayor seguridad
    let processed = content.replace(/<img([^>]+)src="http:\/\//g, '<img$1src="https://');
    
    // Asegurar que las imágenes no excedan el ancho del contenedor
    processed = processed.replace(/<img/g, '<img style="max-width:100%; height:auto;"');
    
    return processed;
};

// Funciones del blog actualizadas
const cargarBlog = async () => {
    const contenedor = document.getElementById('contenedor-blog');
    const url = 'https://public-api.wordpress.com/rest/v1.1/sites/404angelzblog.wordpress.com/posts?number=5';
    
    contenedor.innerHTML = '<div style="padding:20px;text-align:center;"><img src="https://i.ibb.co/8XJf3Zj/hourglass.gif" width="32"><p>Cargando...</p></div>';
  
    try {
        const response = await fetch(url);
        const data = await response.json();
        const entradas = data.posts;
    
        contenedor.innerHTML = entradas.map(entrada => {
            // Extraer la primera imagen del contenido para el thumbnail
            const imgMatch = entrada.content.match(/<img[^>]+src="([^"]+)"[^>]*>/);
            const thumbnail = imgMatch ? 
                `<div class="blog-thumbnail">
                    <img src="${imgMatch[1]}" alt="Miniatura" style="max-width:100%; max-height:150px; margin-bottom:10px;">
                </div>` : '';
            
            return `
                <div class="entrada-blog">
                    ${thumbnail}
                    <h3>${entrada.title}</h3>
                    <p>${entrada.excerpt.replace(/<[^>]+>/g, '')}</p>
                    <button onclick="abrirPostCompleto('${entrada.ID}')" class="win95-button">📖 Leer completo</button>
                    <div class="fecha">${new Date(entrada.date).toLocaleDateString()}</div>
                </div>
            `;
        }).join('') || '<p>No se encontraron entradas.</p>';
    } catch (error) {
        contenedor.innerHTML = `
            <div style="color:red;padding:20px;">
                Error al cargar el blog:<br>${error.message}
            </div>
        `;
    }
};

const abrirPostCompleto = async (postId) => {
    try {
        const response = await fetch(`https://public-api.wordpress.com/rest/v1.1/sites/404angelzblog.wordpress.com/posts/${postId}`);
        const post = await response.json();
        
        const newWindow = document.createElement('div');
        newWindow.className = 'window';
        newWindow.style.width = '700px';
        newWindow.style.height = '500px';
        newWindow.style.display = 'block';
        
        positionWindow(newWindow);
        
        newWindow.innerHTML = `
            <div class="title-bar" onmousedown="startDrag(event, this.parentElement)">
                <span>✰ ${post.title} ✰</span>
                <button class="close-button" onclick="this.parentElement.parentElement.remove()">×</button>
            </div>
            <div class="notepad-body" style="height: calc(100% - 30px); overflow: hidden; padding: 0;">
                <div class="post-content" style="
                    height: 100%;
                    overflow-y: auto;
                    padding: 15px;
                    font-family: 'Pixelify Sans', sans-serif;
                    line-height: 1.5;
                    box-sizing: border-box;
                ">
                    ${processContent(post.content)}
                </div>
            </div>
        `;
        
        document.body.appendChild(newWindow);
        
        newWindow.querySelectorAll('.post-content img').forEach(img => {
            img.style.cursor = 'zoom-in';
            img.onclick = (e) => {
                e.stopPropagation();
                openImageWindow(img.src, post.title);
            };
        });
    } catch (error) {
        alert(`Error al cargar el post: ${error.message}`);
    }
};
// Abrir ventana About al cargar la página
window.addEventListener('DOMContentLoaded', () => {
    openWindow('about', { initialPosition: true }); // Centrada y fija
    openWindow('music', { initialPosition: true }); // Arriba a la derecha y fija
});

// Event listeners
document.addEventListener('click', (e) => {
    if (!startMenu.contains(e.target) && !e.target.closest('.start-button')) {
        startMenu.style.display = 'none';
    }
});

// Asignación de funciones globales
window.toggleStartMenu = toggleStartMenu;
window.openAboutWindow = () => openWindow('about');  // Posicionamiento normal
window.openDiaryWindow = () => openWindow('diary', { forceSize: { width: '800px', height: '650px' } });
window.openGalleryWindow = () => openWindow('gallery');
window.openArtWindow = () => openWindow('art');
window.closeWindow = closeWindow;
window.startDrag = startDrag;
window.cargarBlog = cargarBlog;
window.abrirPostCompleto = abrirPostCompleto;
window.openImageWindow = openImageWindow;
window.openMusicPlayer = () => openWindow('music');  // Posicionamiento normal