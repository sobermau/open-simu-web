// Inicializar Canvas con Konva
const container = document.getElementById('canvas-container');
const stage = new Konva.Stage({
    container: 'canvas-container',
    width: container.clientWidth,
    height: container.clientHeight,
});

const layer = new Konva.Layer();
stage.add(layer);

// Función para dibujar la rejilla (Grid CAD)
function drawGrid() {
    const gridSize = 20;
    const width = stage.width();
    const height = stage.height();

    for (let i = 0; i < width / gridSize; i++) {
        layer.add(new Konva.Line({
            points: [i * gridSize, 0, i * gridSize, height],
            stroke: '#2a2a2a',
            strokeWidth: 1,
        }));
    }
    for (let j = 0; j < height / gridSize; j++) {
        layer.add(new Konva.Line({
            points: [0, j * gridSize, width, j * gridSize],
            stroke: '#2a2a2a',
            strokeWidth: 1,
        }));
    }
}

drawGrid();

// Snapping a la rejilla de 20px
function snapToGrid(pos) {
    const gridSize = 20;
    return {
        x: Math.round(pos.x / gridSize) * gridSize,
        y: Math.round(pos.y / gridSize) * gridSize,
    };
}

// Creador de Componente: Relé Eléctrico (IEC)
function createRelay(x, y) {
    const group = new Konva.Group({
        x: x,
        y: y,
        draggable: true,
    });

    // Cuerpo del Relé
    const box = new Konva.Rect({
        width: 40,
        height: 60,
        stroke: '#007acc',
        strokeWidth: 2,
        fill: '#252526',
        cornerRadius: 2,
    });

    // Terminales de conexión (A1 / A2)
    const pinA1 = new Konva.Circle({ x: 20, y: 0, radius: 4, fill: '#ff5555' });
    const pinA2 = new Konva.Circle({ x: 20, y: 60, radius: 4, fill: '#ff5555' });

    // Texto
    const label = new Konva.Text({
        x: 10,
        y: 22,
        text: 'K1',
        fontSize: 16,
        fill: '#ffffff',
    });

    group.add(box, pinA1, pinA2, label);

    group.on('dragend', () => {
        group.position(snapToGrid(group.position()));
        layer.batchDraw();
    });

    layer.add(group);
    layer.batchDraw();
}

// Creador de Componente: Cilindro Neumático (ISO)
function createCylinder(x, y) {
    const group = new Konva.Group({
        x: x,
        y: y,
        draggable: true,
    });

    // Camisa del cilindro
    const body = new Konva.Rect({
        width: 80,
        height: 30,
        stroke: '#4caf50',
        strokeWidth: 2,
        fill: '#252526',
    });

    // Vástago
    const rod = new Konva.Rect({
        x: 80,
        y: 10,
        width: 40,
        height: 10,
        fill: '#888',
    });

    // Puerto Neumático
    const port = new Konva.Circle({ x: 20, y: 30, radius: 4, fill: '#00bcd4' });

    group.add(body, rod, port);

    group.on('dragend', () => {
        group.position(snapToGrid(group.position()));
        layer.batchDraw();
    });

    layer.add(group);
    layer.batchDraw();
}

// Event Listeners
document.getElementById('add-relay').addEventListener('click', () => createRelay(100, 100));
document.getElementById('add-cylinder').addEventListener('click', () => createCylinder(100, 200));

document.getElementById('btn-clear').addEventListener('click', () => {
    layer.destroyChildren();
    drawGrid();
    layer.batchDraw();
});

// Ajuste dinámico de ventana
window.addEventListener('resize', () => {
    stage.width(container.clientWidth);
    stage.height(container.clientHeight);
    drawGrid();
});
