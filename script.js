const startMenu = document.getElementById('startMenu');
let windowCounter = 0;
let lastWindowPosition = { x: 100, y: 100 }; // Posición inicial para el efecto cascada

function toggleStartMenu() {
  startMenu.style.display = (startMenu.style.display === 'flex') ? 'none' : 'flex';
}

function openAboutWindow() {
  const window = document.getElementById('aboutWindow');
  window.style.display = 'block';
  window.style.left = `${lastWindowPosition.x}px`;
  window.style.top = `${lastWindowPosition.y}px`;
  updateLastWindowPosition(30, 30);
  startMenu.style.display = 'none';
}

function openDiaryWindow() {
  const window = document.getElementById('diaryWindow');
  window.style.display = 'block';
  window.style.left = `${lastWindowPosition.x}px`;
  window.style.top = `${lastWindowPosition.y}px`;
  updateLastWindowPosition(30, 30);
  startMenu.style.display = 'none';
}

function openGalleryWindow() {
  const window = document.getElementById('galleryWindow');
  window.style.display = 'block';
  window.style.left = `${lastWindowPosition.x}px`;
  window.style.top = `${lastWindowPosition.y}px`;
  updateLastWindowPosition(30, 30);
  startMenu.style.display = 'none';
}

function openArtWindow() {
  const window = document.getElementById('artWindow');
  window.style.display = 'block';
  window.style.left = `${lastWindowPosition.x}px`;
  window.style.top = `${lastWindowPosition.y}px`;
  updateLastWindowPosition(30, 30);
  startMenu.style.display = 'none';
}

function closeWindow(id) {
  document.getElementById(id).style.display = 'none';
}

function updateLastWindowPosition(offsetX, offsetY) {
  lastWindowPosition.x += offsetX;
  lastWindowPosition.y += offsetY;
  
  // Si la posición se sale de la pantalla, reiniciar a la posición inicial
  if (lastWindowPosition.y > window.innerHeight * 0.7 || 
      lastWindowPosition.x > window.innerWidth * 0.7) {
    lastWindowPosition = { x: 100, y: 100 };
  }
}

function openImageWindow(src, title) {
  windowCounter++;
  const windowId = `imageWindow-${windowCounter}`;
  
  // Crear nueva ventana
  const newWindow = document.createElement('div');
  newWindow.id = windowId;
  newWindow.className = 'window';
  newWindow.style.display = 'block';
  
  // Posición en cascada
  newWindow.style.left = `${lastWindowPosition.x}px`;
  newWindow.style.top = `${lastWindowPosition.y}px`;
  updateLastWindowPosition(30, 30);
  
  // Crear imagen para calcular dimensiones
  const img = new Image();
  img.src = src;
  
  img.onload = function() {
    const maxHeight = (window.innerHeight * 0.8) - 30; // 30px para la barra de título
    const imgRatio = img.width / img.height;
    
    // Calcular dimensiones manteniendo el ratio
    let imgHeight = Math.min(img.height, maxHeight);
    let imgWidth = imgHeight * imgRatio;
    
    // Si el ancho excede el 80% del viewport, ajustamos
    const maxWidth = window.innerWidth * 0.8;
    if (imgWidth > maxWidth) {
      imgWidth = maxWidth;
      imgHeight = imgWidth / imgRatio;
    }
    
    // Calcular dimensiones totales de la ventana
    const windowWidth = imgWidth;
    const windowHeight = imgHeight + 30; // 30px para la barra de título
    
    newWindow.style.width = `${windowWidth}px`;
    newWindow.style.height = `${windowHeight}px`;
    
    // Contenido de la ventana
    newWindow.innerHTML = `
      <div class="title-bar" onmousedown="startDrag(event, this.parentElement)">
        <span>✰ ${title} ✰</span>
        <button class="close-button" onclick="closeWindow('${windowId}')">×</button>
      </div>
      <div class="image-container">
        <img src="${src}" alt="${title}">
      </div>
    `;
    
    document.body.appendChild(newWindow);
  };
}

// Dragging
let offsetX, offsetY, isDragging = false, currentWindow;

function startDrag(e, element) {
  isDragging = true;
  currentWindow = element;
  offsetX = e.clientX - element.offsetLeft;
  offsetY = e.clientY - element.offsetTop;
  document.addEventListener('mousemove', drag);
  document.addEventListener('mouseup', stopDrag);
}

function drag(e) {
  if (isDragging && currentWindow) {
    currentWindow.style.left = (e.clientX - offsetX) + 'px';
    currentWindow.style.top = (e.clientY - offsetY) + 'px';
  }
}

function stopDrag() {
  isDragging = false;
  document.removeEventListener('mousemove', drag);
  document.removeEventListener('mouseup', stopDrag);
}