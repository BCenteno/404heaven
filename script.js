// Configuración de la aplicación
const APP_CONFIG = {
    desktopIcons: [
      { id: 'about', title: 'About', icon: 'https://i.ibb.co/CpVD8DXP/text-file-2.png', action: 'openAboutWindow' },
      { id: 'diary', title: 'Diary', icon: 'https://i.ibb.co/604BmYcZ/mail.png', action: 'openDiaryWindow' },
      { id: 'gallery', title: 'Gallery', icon: 'https://i.ibb.co/60NK1HD9/camera.png', action: 'openGalleryWindow' },
      { id: 'art', title: 'Art', icon: 'https://i.ibb.co/svVr7w3T/paint.png', action: 'openArtWindow' },
      { id: 'music', title: 'Music Player', icon: 'https://i.ibb.co/Z6N6XvFT/music.png', action: 'openMusicPlayer' }
    ],
    galleryImages: [
      { src: 'https://i.ibb.co/wF4LPWjd/20250503-175720.jpg', title: 'Pipa Long' },
      { src: 'https://i.ibb.co/yBfs5vG6/pipa.jpg', title: 'Pipa :)' }
    ],
    artImages: [
      { src: 'https://i.ibb.co/gKkdzGF/girl2.jpg', title: 'Girl2' },
      { src: 'https://i.ibb.co/tgyTcYh/fish.jpg', title: 'Fisher' },
      { src: 'https://i.ibb.co/QvH7C2Qs/cat.jpg', title: 'Dancing Cat' },
      { src: 'https://i.ibb.co/Dfs4DQSL/girl.jpg', title: 'Girl' },
      { src: 'https://i.ibb.co/QFWGLhgw/creepy.jpg', title: 'Creepy' },
      { src: 'https://i.ibb.co/BVLq0Ftm/oc.jpg', title: 'OC(unnamed)2' },
      { src: 'https://i.ibb.co/NgXW7VfG/ninja.jpg', title: 'Ninja' },
      { src: 'https://i.ibb.co/r2rzf06R/oc2.jpg', title: 'OC(unnamed)' },
      { src: 'https://i.ibb.co/gLzLww1N/slime.jpg', title: 'SlimeHead' },
      { src: 'https://i.ibb.co/Jw4VCj0K/spina.jpg', title: 'Spiky' },
      { src: 'https://i.ibb.co/B2C7D0Nb/whale.jpg', title: 'Whale' },
      { src: 'https://i.ibb.co/N64VPX27/tentacle.jpg', title: 'Tentacle' },
      { src: 'https://i.ibb.co/5gj3fNPw/two.jpg', title: 'Team' },
      { src: 'https://i.ibb.co/1ftP96w6/asd.png', title: 'Axolotl Persona' },
      { src: 'https://i.ibb.co/XM4sppJ/Sprite-0001.gif', title: 'First Pixel Art Animation' },
      { src: 'https://i.ibb.co/twnNcRKN/mumin.jpg', title: 'Mandy Moomin' }
    ],
    windowSettings: {
        about: { 
          width: '600px', 
          height: '650px', 
          top: '100px', 
          left: '50%', 
          transform: 'translateX(-50%)',
          display: 'block'
        },
        diary: { 
          width: '800px', 
          height: '650px',
          display: 'none'
        },
        gallery: { 
          width: '480px', 
          height: '320px', 
          top: '200px', 
          left: '250px',
          display: 'none'
        },
        art: { 
          width: '480px', 
          height: '320px', 
          top: '250px', 
          left: '300px',
          display: 'none'
        },
        music: { 
          width: '430px', 
          height: '180px', 
          top: '20px', 
          right: '20px', 
          left: 'auto',
          display: 'block'
        }
      }
    };
  
  // Estado global
  let state = {
    windowCounter: 0,
    lastWindowPosition: { x: 100, y: 100 },
    isDragging: false,
    currentWindow: null,
    offset: { x: 0, y: 0 }
  };
  
  // Inicialización
  function init() {
    createDesktopIcons();
    createStartMenu();
    applyWindowSettings();
    
    // Mostrar ventanas iniciales
    document.getElementById('aboutWindow').style.display = 'block';
    document.getElementById('musicWindow').style.display = 'block';
    
    document.addEventListener('click', (e) => {
      if (!startMenu.contains(e.target) && !e.target.closest('.start-button')) {
        startMenu.style.display = 'none';
      }
    });
  }
  
  // Crear iconos del escritorio
  function createDesktopIcons() {
    const desktop = document.getElementById('desktop');
    APP_CONFIG.desktopIcons.forEach(icon => {
      desktop.appendChild(createIconElement(icon));
    });
  }
  
  // Crear menú de inicio
  function createStartMenu() {
    const menu = document.getElementById('startMenu');
    APP_CONFIG.desktopIcons.forEach(icon => {
      menu.appendChild(createIconElement(icon));
    });
  }
  
  // Crear elemento de icono
  function createIconElement({ icon, title, action }) {
    const div = document.createElement('div');
    div.className = 'desktop-icon';
    div.onclick = () => window[action]();
    div.title = title;
    div.innerHTML = `<img src="${icon}" alt="${title}"><div>${title}</div>`;
    return div;
  }
  
  // Aplicar configuraciones de ventana
  function applyWindowSettings() {
    Object.entries(APP_CONFIG.windowSettings).forEach(([id, settings]) => {
      const window = document.getElementById(`${id}Window`);
      if (window) {
        Object.entries(settings).forEach(([prop, value]) => {
          // No aplicar 'display' desde los settings ya que lo controlamos con openWindow
          if (prop !== 'display') {
            window.style[prop] = value;
          }
        });
      }
    });
    
    // Llenar galerías
    fillGallery('gallery', APP_CONFIG.galleryImages);
    fillGallery('art', APP_CONFIG.artImages);
  }
  
  // Llenar galería con imágenes
  function fillGallery(galleryId, images) {
    const gallery = document.querySelector(`#${galleryId}Window .thumbnail-grid`);
    if (gallery) {
      gallery.innerHTML = images.map(img => `
        <div class="thumbnail" onclick="openImageWindow('${img.src}', '${img.title}')">
          <img src="${img.src}" alt="${img.title}">
          <div>${img.title}</div>
        </div>
      `).join('');
    }
  }
  
  // Funciones de ventana
  function toggleDisplay(element, displayType = 'flex') {
    element.style.display = element.style.display === displayType ? 'none' : displayType;
  }
  
  function toggleStartMenu() {
    toggleDisplay(startMenu);
  }
  
  function openWindow(id, options = {}) {
    const window = document.getElementById(`${id}Window`);
    if (!window) return;
  
    if (options.forceSize) {
      window.style.width = options.forceSize.width;
      window.style.height = options.forceSize.height;
    }
  
    if (!options.initialPosition) {
      positionWindow(window);
    }
  
    window.style.display = 'block';
    startMenu.style.display = 'none';
  
    if (id === 'diary') cargarBlog();
  }
  
  function closeWindow(id) {
    const window = typeof id === 'string' ? document.getElementById(id) : id;
    if (window) window.style.display = 'none';
  }
  
  function positionWindow(windowElement) {
    const anyWindowVisible = [...document.querySelectorAll('.window')].some(
      win => win.style.display === 'block' && win !== windowElement
    );
  
    if (anyWindowVisible) {
      windowElement.style.left = `${state.lastWindowPosition.x}px`;
      windowElement.style.top = `${state.lastWindowPosition.y}px`;
      updateLastWindowPosition();
    } else {
      centerWindow(windowElement);
    }
  }
  
  function centerWindow(windowElement) {
    const width = parseInt(windowElement.style.width) || 480;
    const height = parseInt(windowElement.style.height) || 320;
    
    windowElement.style.left = `${(window.innerWidth - width) / 2}px`;
    windowElement.style.top = `${(window.innerHeight - height) / 2}px`;
    
    state.lastWindowPosition = { 
      x: (window.innerWidth - width) / 2 + 30, 
      y: (window.innerHeight - height) / 2 + 30 
    };
  }
  
  function updateLastWindowPosition(offsetX = 30, offsetY = 30) {
    state.lastWindowPosition.x += offsetX;
    state.lastWindowPosition.y += offsetY;
    
    if (state.lastWindowPosition.y > window.innerHeight * 0.7 || 
        state.lastWindowPosition.x > window.innerWidth * 0.7) {
      state.lastWindowPosition = { x: 100, y: 100 };
    }
  }
  
  // Funciones de arrastre
  function startDrag(e, element) {
    state.isDragging = true;
    state.currentWindow = element;
    state.offset = { 
      x: e.clientX - element.offsetLeft, 
      y: e.clientY - element.offsetTop 
    };
    document.addEventListener('mousemove', drag);
    document.addEventListener('mouseup', stopDrag);
  }
  
  function drag(e) {
    if (state.isDragging && state.currentWindow) {
      state.currentWindow.style.left = `${e.clientX - state.offset.x}px`;
      state.currentWindow.style.top = `${e.clientY - state.offset.y}px`;
    }
  }
  
  function stopDrag() {
    state.isDragging = false;
    document.removeEventListener('mousemove', drag);
    document.removeEventListener('mouseup', stopDrag);
  }
  
  // Funciones de imagen
  function openImageWindow(src, title) {
    state.windowCounter++;
    const windowId = `imageWindow-${state.windowCounter}`;
    const newWindow = document.createElement('div');
    
    newWindow.id = windowId;
    newWindow.className = 'window';
    newWindow.style.display = 'block';
    
    const img = new Image();
    img.src = src;
    
    img.onload = function() {
      const maxHeight = window.innerHeight * 0.8 - 30;
      const maxWidth = window.innerWidth * 0.8;
      const imgRatio = img.width / img.height;
      
      let [imgWidth, imgHeight] = calculateImageSize(img.width, img.height, maxWidth, maxHeight, imgRatio);
      
      newWindow.style.width = `${imgWidth}px`;
      newWindow.style.height = `${imgHeight + 30}px`;
      
      const [left, top] = calculateWindowPosition(imgWidth, imgHeight);
      
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
  }
  
  function calculateImageSize(width, height, maxWidth, maxHeight, ratio) {
    let imgWidth = width;
    let imgHeight = height;
    
    if (imgWidth > maxWidth) {
      imgWidth = maxWidth;
      imgHeight = imgWidth / ratio;
    }
    
    if (imgHeight > maxHeight) {
      imgHeight = maxHeight;
      imgWidth = imgHeight * ratio;
    }
    
    const minSize = 300;
    return [
      imgWidth < minSize ? minSize : imgWidth,
      imgHeight < minSize ? minSize : imgHeight
    ];
  }
  
  function calculateWindowPosition(width, height) {
    return [
      Math.max(10, (window.innerWidth - width) / 2),
      Math.max(10, (window.innerHeight - height - 30) / 2)
    ];
  }
  
  // Funciones del blog
  async function cargarBlog() {
    const contenedor = document.getElementById('contenedor-blog');
    const url = 'https://public-api.wordpress.com/rest/v1.1/sites/404angelzblog.wordpress.com/posts?number=5';
    
    contenedor.innerHTML = `
      <div style="padding:20px;text-align:center;">
        <img src="https://i.ibb.co/8XJf3Zj/hourglass.gif" width="32">
        <p>Cargando...</p>
      </div>
    `;
    
    try {
      const response = await fetch(url);
      const data = await response.json();
      contenedor.innerHTML = data.posts.map(createBlogPost).join('') || '<p>No se encontraron entradas.</p>';
    } catch (error) {
      contenedor.innerHTML = `
        <div style="color:red;padding:20px;">
          Error al cargar el blog:<br>${error.message}
        </div>
      `;
    }
  }
  
  function createBlogPost(post) {
    const imgMatch = post.content.match(/<img[^>]+src="([^"]+)"[^>]*>/);
    const thumbnail = imgMatch ? `
      <div class="blog-thumbnail">
        <img src="${imgMatch[1]}" alt="Miniatura" style="max-width:100%; max-height:150px; margin-bottom:10px;">
      </div>
    ` : '';
    
    return `
      <div class="entrada-blog">
        ${thumbnail}
        <h3>${post.title}</h3>
        <p>${post.excerpt.replace(/<[^>]+>/g, '')}</p>
        <button onclick="abrirPostCompleto('${post.ID}')" class="win95-button">📖 Leer completo</button>
        <div class="fecha">${new Date(post.date).toLocaleDateString()}</div>
      </div>
    `;
  }
  
  async function abrirPostCompleto(postId) {
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
          <div class="post-content">
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
  }
  
  function processContent(content) {
    return content
      .replace(/<img([^>]+)src="http:\/\//g, '<img$1src="https://')
      .replace(/<img/g, '<img style="max-width:100%; height:auto;"');
  }
  
  // Asignación de funciones globales
  window.toggleStartMenu = toggleStartMenu;
  window.openAboutWindow = () => openWindow('about');
  window.openDiaryWindow = () => openWindow('diary', { forceSize: { width: '800px', height: '650px' } });
  window.openGalleryWindow = () => openWindow('gallery');
  window.openArtWindow = () => openWindow('art');
  window.openMusicPlayer = () => openWindow('music');
  window.closeWindow = closeWindow;
  window.startDrag = startDrag;
  window.cargarBlog = cargarBlog;
  window.abrirPostCompleto = abrirPostCompleto;
  window.openImageWindow = openImageWindow;
  
  // Inicializar la aplicación
  document.addEventListener('DOMContentLoaded', init);