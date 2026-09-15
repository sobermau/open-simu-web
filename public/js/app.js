// Contenedor e inicialización de Konva Canvas
const container = document.getElementById('canvas-container');
const stage = new Konva.Stage({
    container: 'canvas-container',
    width: container.clientWidth,
    height: container.clientHeight,
});

const layer = new Konva.Layer();
stage.add(layer);

// Estado global para manejo de conexiones y estado
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

// Ruta ortogonal (ángulos a 90 grados)
function getOrthogonalPoints(p1, p2) {
    const midX = p1.x + (p2.x - p1.x) / 2;
    return [p1.x, p1.y, midX, p1.y, midX, p2.y, p2.x, p2.y];
}

// Crear Pin / Terminal de conexión interactivo
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

    pin.on('mousedown', (e) => {
        e.cancelBubble = true;
        const absolutePos = pin.getAbsolutePosition();

        if (!selectedPin) {
            selectedPin = pin;
            tempLine = new Konva.Line({
                points: [absolutePos.x, absolutePos.y, absolutePos.x, absolutePos.y],
                stroke: pinType === 'electrical' ? '#ffcc00' : '#0288d1',
                strokeWidth: 2,
                dash: [4, 4],
            });
            layer.add(tempLine);
        } else if (selectedPin !== pin) {
            const startPos = selectedPin.getAbsolutePosition();
            const endPos = pin.getAbsolutePosition();

            const wire = new Konva.Line({
                points: getOrthogonalPoints(startPos, endPos),
                                        stroke: pinType === 'electrical' ? '#ffcc00' : '#0288d1',
                                        strokeWidth: 2.5,
            });

            layer.add(wire);
            wires.push({ wire, startPin: selectedPin, endPin: pin });

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

// Actualizar cables dinámicamente al arrastrar objetos
function updateWires() {
    wires.forEach(({ wire, startPin, endPin }) => {
        const p1 = startPin.getAbsolutePosition();
        const p2 = endPin.getAbsolutePosition();
        wire.points(getOrthogonalPoints(p1, p2));
    });
}

// --- GENERADORES DE COMPONENTES ---

// 1. Fuente de Alimentación
function createPowerSupply(x, y) {
    const group = new Konva.Group({ x, y, draggable: true });

    const line24V = new Konva.Line({ points: [0, 0, 40, 0], stroke: '#ef5350', strokeWidth: 3 });
    const text24V = new Konva.Text({ x: 45, y: -5, text: '+24V', fill: '#ef5350', fontSize: 12, fontStyle: 'bold' });

    const line0V = new Konva.Line({ points: [0, 40, 40, 40], stroke: '#42a5f5', strokeWidth: 3 });
    const text0V = new Konva.Text({ x: 45, y: 35, text: '0V', fill: '#42a5f5', fontSize: 12, fontStyle: 'bold' });

    group.add(line24V, text24V, line0V, text0V);

    createPin(group, 20, 0, 'electrical');
    createPin(group, 20, 40, 'electrical');

    group.on('dragmove', () => { updateWires(); layer.batchDraw(); });
    group.on('dragend', () => { group.position(snapToGrid(group.position())); updateWires(); layer.batchDraw(); });

    layer.add(group);
    layer.batchDraw();
}

// 2. Pulsador NA (IEC)
function createPushButton(x, y) {
    const group = new Konva.Group({ x, y, draggable: true });

    const topTerm = new Konva.Line({ points: [15, 0, 15, 15], stroke: '#ffffff', strokeWidth: 2 });
    const botTerm = new Konva.Line({ points: [15, 35, 15, 50], stroke: '#ffffff', strokeWidth: 2 });
    const dot1 = new Konva.Circle({ x: 15, y: 15, radius: 2, fill: '#ffffff' });
    const dot2 = new Konva.Circle({ x: 15, y: 35, radius: 2, fill: '#ffffff' });
    const bridge = new Konva.Line({ points: [5, 12, 22, 12], stroke: '#ffffff', strokeWidth: 2 });
    const actuator = new Konva.Line({ points: [13.5, 0, 13.5, 12], stroke: '#ffffff', strokeWidth: 1.5, dash: [2, 2] });
    const label = new Konva.Text({ x: 30, y: 18, text: 'S1', fontSize: 14, fill: '#ffffff' });

    group.add(topTerm, botTerm, dot1, dot2, bridge, actuator, label);

    createPin(group, 15, 0, 'electrical');
    createPin(group, 15, 50, 'electrical');

    group.on('dragmove', () => { updateWires(); layer.batchDraw(); });
    group.on('dragend', () => { group.position(snapToGrid(group.position())); updateWires(); layer.batchDraw(); });

    layer.add(group);
    layer.batchDraw();
}

// 3. Relé / Bobina (IEC)
function createRelay(x, y) {
    const group = new Konva.Group({ x, y, draggable: true });

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

    group.on('dragmove', () => { updateWires(); layer.batchDraw(); });
    group.on('dragend', () => { group.position(snapToGrid(group.position())); updateWires(); layer.batchDraw(); });

    layer.add(group);
    layer.batchDraw();
}

// 4. Válvula 3/2 Electroválvula (ISO)
function createValve32(x, y) {
    const group = new Konva.Group({ x, y, draggable: true });

    const box1 = new Konva.Rect({ x: 0, y: 0, width: 30, height: 30, stroke: '#4caf50', strokeWidth: 2, fill: '#252526' });
    const box2 = new Konva.Rect({ x: 30, y: 0, width: 30, height: 30, stroke: '#4caf50', strokeWidth: 2, fill: '#252526' });
    const arrow = new Konva.Arrow({ points: [45, 25, 45, 5], pointerLength: 4, pointerWidth: 4, fill: '#4caf50', stroke: '#4caf50', strokeWidth: 1.5 });
    const block = new Konva.Line({ points: [10, 25, 20, 25], stroke: '#ef5350', strokeWidth: 2 });
    const solenoid = new Konva.Rect({ x: -15, y: 7.5, width: 15, height: 15, stroke: '#ffcc00', strokeWidth: 1.5 });
    const solLabel = new Konva.Text({ x: -13, y: -7, text: 'Y1', fontSize: 10, fill: '#ffcc00' });

    group.add(box1, box2, arrow, block, solenoid, solLabel);

    createPin(group, 45, 30, 'pneumatic');
    createPin(group, 45, 0, 'pneumatic');
    createPin(group, -7.5, 7.5, 'electrical');

    group.on('dragmove', () => { updateWires(); layer.batchDraw(); });
    group.on('dragend', () => { group.position(snapToGrid(group.position())); updateWires(); layer.batchDraw(); });

    layer.add(group);
    layer.batchDraw();
}

// 5. Cilindro Neumático (ISO)
function createCylinder(x, y) {
    const group = new Konva.Group({ x, y, draggable: true });

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
    createPin(group, 20, 30, 'pneumatic');

    group.on('dragmove', () => { updateWires(); layer.batchDraw(); });
    group.on('dragend', () => { group.position(snapToGrid(group.position())); updateWires(); layer.batchDraw(); });

    layer.add(group);
    layer.batchDraw();
}

// --- MANEJO DE EVENTOS DE BOTONES (ASIGNACIÓN ÚNICA) ---

function setupButtons() {
    const btnMap = [
        { id: 'add-power', fn: () => createPowerSupply(60, 60) },
        { id: 'add-pushbutton', fn: () => createPushButton(180, 60) },
        { id: 'add-relay', fn: () => createRelay(180, 160) },
        { id: 'add-valve32', fn: () => createValve32(300, 160) },
        { id: 'add-cylinder', fn: () => createCylinder(400, 160) },
    ];

    btnMap.forEach(({ id, fn }) => {
        const btn = document.getElementById(id);
        if (btn) {
            // Reemplazar nodo para eliminar cualquier event listener previo
            const cleanBtn = btn.cloneNode(true);
            btn.parentNode.replaceChild(cleanBtn, btn);
            cleanBtn.addEventListener('click', fn);
        }
    });

    const clearBtn = document.getElementById('btn-clear');
    if (clearBtn) {
        const cleanClearBtn = clearBtn.cloneNode(true);
        clearBtn.parentNode.replaceChild(cleanClearBtn, clearBtn);
        cleanClearBtn.addEventListener('click', () => {
            layer.destroyChildren();
            wires.length = 0;
            drawGrid();
            layer.batchDraw();
        });
    }
}

// Inicializar botones al cargar la página
setupButtons();

// Seguir el ratón mientras se dibuja un cable
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

// Ajuste dinámico del tamaño de ventana
window.addEventListener('resize', () => {
    stage.width(container.clientWidth);
    stage.height(container.clientHeight);
    drawGrid();
});
