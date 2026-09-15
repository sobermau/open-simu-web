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

// [Mantener todo el encabezado, setup de Konva, grid, wires y createPin igual que antes]

// Creador: Fuente de Alimentación 24V / 0V
function createPowerSupply(x, y) {
    const group = new Konva.Group({ x, y, draggable: true });

    const line24V = new Konva.Line({ points: [0, 0, 40, 0], stroke: '#ef5350', strokeWidth: 3 });
    const text24V = new Konva.Text({ x: 45, y: -5, text: '+24V', fill: '#ef5350', fontSize: 12, fontStyle: 'bold' });

    const line0V = new Konva.Line({ points: [0, 40, 40, 40], stroke: '#42a5f5', strokeWidth: 3 });
    const text0V = new Konva.Text({ x: 45, y: 35, text: '0V', fill: '#42a5f5', fontSize: 12, fontStyle: 'bold' });

    group.add(line24V, text24V, line0V, text0V);

    createPin(group, 20, 0, 'electrical');  // Terminal +24V
    createPin(group, 20, 40, 'electrical'); // Terminal 0V

    group.on('dragmove', () => { updateWires(); layer.batchDraw(); });
    group.on('dragend', () => { group.position(snapToGrid(group.position())); updateWires(); layer.batchDraw(); });

    layer.add(group);
    layer.batchDraw();
}

// Creador: Pulsador Normal Abierto (NA / NO) - IEC
function createPushButton(x, y) {
    const group = new Konva.Group({ x, y, draggable: true });

    // Terminales verticales
    const topTerm = new Konva.Line({ points: [15, 0, 15, 15], stroke: '#ffffff', strokeWidth: 2 });
    const botTerm = new Konva.Line({ points: [15, 35, 15, 50], stroke: '#ffffff', strokeWidth: 2 });

    // Contactos fijos
    const dot1 = new Konva.Circle({ x: 15, y: 15, radius: 2, fill: '#ffffff' });
    const dot2 = new Konva.Circle({ x: 15, y: 35, radius: 2, fill: '#ffffff' });

    // Puente móvil (Pulsador Abierto)
    const bridge = new Konva.Line({ points: [5, 12, 22, 12], stroke: '#ffffff', strokeWidth: 2 });
    const actuator = new Konva.Line({ points: [13.5, 0, 13.5, 12], stroke: '#ffffff', strokeWidth: 1.5, dash: [2, 2] });

    const label = new Konva.Text({ x: 30, y: 18, text: 'S1', fontSize: 14, fill: '#ffffff' });

    group.add(topTerm, botTerm, dot1, dot2, bridge, actuator, label);

    createPin(group, 15, 0, 'electrical');  // Pin 13 / Entrada
    createPin(group, 15, 50, 'electrical'); // Pin 14 / Salida

    group.on('dragmove', () => { updateWires(); layer.batchDraw(); });
    group.on('dragend', () => { group.position(snapToGrid(group.position())); updateWires(); layer.batchDraw(); });

    layer.add(group);
    layer.batchDraw();
}

// Creador: Válvula 3/2 Neumática accionada por Solenoide - ISO
function createValve32(x, y) {
    const group = new Konva.Group({ x, y, draggable: true });

    // Cuadros de posición (2 posiciones)
    const box1 = new Konva.Rect({ x: 0, y: 0, width: 30, height: 30, stroke: '#4caf50', strokeWidth: 2, fill: '#252526' });
    const box2 = new Konva.Rect({ x: 30, y: 0, width: 30, height: 30, stroke: '#4caf50', strokeWidth: 2, fill: '#252526' });

    // Símbolo Vía/Flujo interno
    const arrow = new Konva.Arrow({ points: [45, 25, 45, 5], pointerLength: 4, pointerWidth: 4, fill: '#4caf50', stroke: '#4caf50', strokeWidth: 1.5 });
    const block = new Konva.Line({ points: [10, 25, 20, 25], stroke: '#ef5350', strokeWidth: 2 });

    // Solenoide eléctrico a la izquierda (Y1)
    const solenoid = new Konva.Rect({ x: -15, y: 7.5, width: 15, height: 15, stroke: '#ffcc00', strokeWidth: 1.5 });
    const solLabel = new Konva.Text({ x: -13, y: -7, text: 'Y1', fontSize: 10, fill: '#ffcc00' });

    group.add(box1, box2, arrow, block, solenoid, solLabel);

    // Puertos neumáticos (1=Presión, 2=Trabajo)
    createPin(group, 45, 30, 'pneumatic'); // Puerto 1
    createPin(group, 45, 0, 'pneumatic');  // Puerto 2
    createPin(group, -7.5, 7.5, 'electrical'); // Terminal Solenoide Y1

    group.on('dragmove', () => { updateWires(); layer.batchDraw(); });
    group.on('dragend', () => { group.position(snapToGrid(group.position())); updateWires(); layer.batchDraw(); });

    layer.add(group);
    layer.batchDraw();
}

// [Mantener createRelay y createCylinder como los teníamos]

// Event Listeners para la nueva biblioteca
document.getElementById('add-power').addEventListener('click', () => createPowerSupply(60, 60));
document.getElementById('add-pushbutton').addEventListener('click', () => createPushButton(180, 60));
document.getElementById('add-relay').addEventListener('click', () => createRelay(180, 160));
document.getElementById('add-valve32').addEventListener('click', () => createValve32(300, 160));
document.getElementById('add-cylinder').addEventListener('click', () => createCylinder(400, 160));

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
