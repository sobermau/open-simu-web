const container = document.getElementById('canvas-container');
const stage = new Konva.Stage({
    container: 'canvas-container',
    width: container.clientWidth,
    height: container.clientHeight,
});

const layer = new Konva.Layer();
stage.add(layer);

// Estado global para manejo de conexiones
let selectedPin = null;
let tempLine = null;
const wires = [];

// Dibujar rejilla estilo CAD
function drawGrid() {
    const gridSize = 20;
    const width = stage.width();
    const height = stage.height();

    for (let i = 0; i < width / gridSize; i++) {
        layer.add(new Konva.Line({
            points: [i * gridSize, 0, i * gridSize, height],
            stroke: '#2a2a2a',
            strokeWidth: 1,
            listening: false,
        }));
    }
    for (let j = 0; j < height / gridSize; j++) {
        layer.add(new Konva.Line({
            points: [0, j * gridSize, width, j * gridSize],
            stroke: '#2a2a2a',
            strokeWidth: 1,
            listening: false,
        }));
    }
}

drawGrid();

function snapToGrid(pos) {
    const gridSize = 20;
    return {
        x: Math.round(pos.x / gridSize) * gridSize,
        y: Math.round(pos.y / gridSize) * gridSize,
    };
}

// Calcular ruta ortogonal (a 90 grados) entre dos puntos
function getOrthogonalPoints(p1, p2) {
    const midX = p1.x + (p2.x - p1.x) / 2;
    return [p1.x, p1.y, midX, p1.y, midX, p2.y, p2.x, p2.y];
}

// Crear Pin/Terminal interactivo
function createPin(group, relativeX, relativeY, pinType = 'electrical') {
    const color = pinType === 'electrical' ? '#ff5555' : '#00bcd4';

    const pin = new Konva.Circle({
        x: relativeX,
        y: relativeY,
        radius: 5,
        fill: color,
        stroke: '#ffffff',
        strokeWidth: 1,
    });

    // Eventos de conexión entre terminales
    pin.on('mousedown', (e) => {
        e.cancelBubble = true; // Evitar arrastrar el componente
        const absolutePos = pin.getAbsolutePosition();

        if (!selectedPin) {
            // Iniciar trazo de cable
            selectedPin = pin;
            tempLine = new Konva.Line({
                points: [absolutePos.x, absolutePos.y, absolutePos.x, absolutePos.y],
                stroke: pinType === 'electrical' ? '#ffcc00' : '#0288d1',
                strokeWidth: 2,
                dash: [4, 4],
            });
            layer.add(tempLine);
        } else if (selectedPin !== pin) {
            // Finalizar trazo al conectar con otro pin
            const startPos = selectedPin.getAbsolutePosition();
            const endPos = pin.getAbsolutePosition();

            const wire = new Konva.Line({
                points: getOrthogonalPoints(startPos, endPos),
                                        stroke: pinType === 'electrical' ? '#ffcc00' : '#0288d1',
                                        strokeWidth: 2.5,
            });

            layer.add(wire);
            wires.push({ wire, startPin: selectedPin, endPin: pin });

            // Limpiar estado temporal
            tempLine.destroy();
            tempLine = null;
            selectedPin = null;
            layer.batchDraw();
        }
    });

    pin.on('mouseenter', () => {
        document.body.style.cursor = 'crosshair';
        pin.radius(7);
        layer.batchDraw();
    });

    pin.on('mouseleave', () => {
        document.body.style.cursor = 'default';
        pin.radius(5);
        layer.batchDraw();
    });

    group.add(pin);
    return pin;
}

// Actualizar cables cuando se mueven los componentes
function updateWires() {
    wires.forEach(({ wire, startPin, endPin }) => {
        const p1 = startPin.getAbsolutePosition();
        const p2 = endPin.getAbsolutePosition();
        wire.points(getOrthogonalPoints(p1, p2));
    });
}

// Creador de Componente: Relé Eléctrico (IEC)
function createRelay(x, y) {
    const group = new Konva.Group({
        x: x,
        y: y,
        draggable: true,
    });

    const box = new Konva.Rect({
        width: 40,
        height: 60,
        stroke: '#007acc',
        strokeWidth: 2,
        fill: '#252526',
        cornerRadius: 2,
    });

    const label = new Konva.Text({
        x: 11,
        y: 22,
        text: 'K1',
        fontSize: 16,
        fill: '#ffffff',
    });

    group.add(box, label);
    createPin(group, 20, 0, 'electrical');  // Terminal A1
    createPin(group, 20, 60, 'electrical'); // Terminal A2

    group.on('dragmove', () => {
        updateWires();
        layer.batchDraw();
    });

    group.on('dragend', () => {
        group.position(snapToGrid(group.position()));
        updateWires();
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

    const body = new Konva.Rect({
        width: 80,
        height: 30,
        stroke: '#4caf50',
        strokeWidth: 2,
        fill: '#252526',
    });

    const rod = new Konva.Rect({
        x: 80,
        y: 10,
        width: 40,
        height: 10,
        fill: '#888',
    });

    group.add(body, rod);
    createPin(group, 20, 30, 'pneumatic'); // Puerto de aire

    group.on('dragmove', () => {
        updateWires();
        layer.batchDraw();
    });

    group.on('dragend', () => {
        group.position(snapToGrid(group.position()));
        updateWires();
        layer.batchDraw();
    });

    layer.add(group);
    layer.batchDraw();
}

// Seguir el puntero mientras se dibuja la línea temporal
stage.on('mousemove', () => {
    if (selectedPin && tempLine) {
        const startPos = selectedPin.getAbsolutePosition();
        const mousePos = stage.getPointerPosition();
        tempLine.points(getOrthogonalPoints(startPos, mousePos));
        layer.batchDraw();
    }
});

// Cancelar cableado con Click Derecho o ESC
stage.on('contentContextmenu', (e) => e.evt.preventDefault());
window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && selectedPin) {
        if (tempLine) tempLine.destroy();
        tempLine = null;
        selectedPin = null;
        layer.batchDraw();
    }
});

// Event Listeners
document.getElementById('add-relay').addEventListener('click', () => createRelay(100, 100));
document.getElementById('add-cylinder').addEventListener('click', () => createCylinder(100, 200));

document.getElementById('btn-clear').addEventListener('click', () => {
    layer.destroyChildren();
    wires.length = 0;
    drawGrid();
    layer.batchDraw();
});

window.addEventListener('resize', () => {
    stage.width(container.clientWidth);
    stage.height(container.clientHeight);
    drawGrid();
});
