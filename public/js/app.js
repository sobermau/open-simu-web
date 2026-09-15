const container = document.getElementById('canvas-container');

const stage = new Konva.Stage({
    container: 'canvas-container',
    width: container ? container.clientWidth : 800,
    height: container ? container.clientHeight : 600,
});

// Hacer que el lienzo sea enfocable para capturar eventos de teclado siempre
stage.container().tabIndex = 1;
stage.container().focus();

const layer = new Konva.Layer();
stage.add(layer);

// Estados globales
let isSimulating = false;
let simulationInterval = null;
let selectedPin = null;
let tempLine = null;
let selectedElement = null;
let selectionBox = null;

window.wires = [];
window.components = [];

// ==========================================
// REJILLA
// ==========================================
function drawGrid() {
    const gridSize = 20;
    const width = stage.width();
    const height = stage.height();

    for (let i = 0; i < width / gridSize; i++) {
        layer.add(new Konva.Line({
            points: [i * gridSize, 0, i * gridSize, height],
            stroke: '#2a2a2a', strokeWidth: 1, listening: false,
        }));
    }
    for (let j = 0; j < height / gridSize; j++) {
        layer.add(new Konva.Line({
            points: [0, j * gridSize, width, j * gridSize],
            stroke: '#2a2a2a', strokeWidth: 1, listening: false,
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

function getOrthogonalPoints(p1, p2) {
    const midX = p1.x + (p2.x - p1.x) / 2;
    return [p1.x, p1.y, midX, p1.y, midX, p2.y, p2.x, p2.y];
}

// Crea una zona invisible que responde al clic en todo el área del grupo
function addHitArea(group, width, height) {
    const hitArea = new Konva.Rect({
        x: -10,
        y: -10,
        width: width + 20,
        height: height + 20,
        fill: 'rgba(0,0,0,0.001)',
                                   listening: true
    });
    group.add(hitArea);
    hitArea.moveToBottom();
    return hitArea;
}

// ==========================================
// SELECCIÓN Y ELIMINACIÓN DE ELEMENTOS
// ==========================================
function clearSelection() {
    if (selectionBox) {
        selectionBox.destroy();
        selectionBox = null;
    }
    if (selectedElement && selectedElement.className === 'Line') {
        const wireObj = window.wires.find(w => w.wire === selectedElement);
        if (wireObj) {
            selectedElement.stroke(wireObj.startPin.pinType === 'electrical' ? '#888888' : '#0288d1');
        }
    }
    selectedElement = null;
    layer.batchDraw();
}

function updateSelectionBox() {
    if (selectionBox) {
        selectionBox.destroy();
        selectionBox = null;
    }

    if (selectedElement && window.components.includes(selectedElement)) {
        const box = selectedElement.getClientRect({ relativeTo: layer });
        selectionBox = new Konva.Rect({
            x: box.x - 4,
            y: box.y - 4,
            width: box.width + 8,
            height: box.height + 8,
            stroke: '#ff0055',
            strokeWidth: 2,
            dash: [6, 4],
            listening: false
        });
        layer.add(selectionBox);
    }
}

window.deleteElement = function(element) {
    if (isSimulating || !element) return;

    if (window.components.includes(element)) {
        const pins = element.find('Circle');
        pins.forEach(pin => {
            for (let i = window.wires.length - 1; i >= 0; i--) {
                if (window.wires[i].startPin === pin || window.wires[i].endPin === pin) {
                    window.wires[i].wire.destroy();
                    window.wires.splice(i, 1);
                }
            }
        });

        const index = window.components.indexOf(element);
        if (index > -1) window.components.splice(index, 1);
        element.destroy();
    } else if (element.className === 'Line') {
        const wireIndex = window.wires.findIndex(w => w.wire === element);
        if (wireIndex > -1) {
            window.wires[wireIndex].wire.destroy();
            window.wires.splice(wireIndex, 1);
        }
    }

    clearSelection();
    layer.batchDraw();
};

// ==========================================
// TERMINALES Y CABLES
// ==========================================
function createPin(group, relativeX, relativeY, pinType = 'electrical', role = 'generic') {
    const color = pinType === 'electrical' ? '#ff5555' : '#00bcd4';

    const pin = new Konva.Circle({
        x: relativeX, y: relativeY, radius: 6, fill: color, stroke: '#ffffff', strokeWidth: 1.5,
    });

    pin.pinType = pinType;
    pin.role = role;
    pin.parentComponent = group;
    pin.isPin = true;

    pin.on('mousedown tap', (e) => {
        if (isSimulating) return;
        if (e.evt && e.evt.button !== 0 && e.evt.button !== undefined) return;

        e.cancelBubble = true;
        const absolutePos = pin.getAbsolutePosition();

        if (!selectedPin) {
            selectedPin = pin;
            tempLine = new Konva.Line({
                points: [absolutePos.x, absolutePos.y, absolutePos.x, absolutePos.y],
                stroke: pinType === 'electrical' ? '#ffcc00' : '#0288d1',
                strokeWidth: 2, dash: [4, 4],
            });
            layer.add(tempLine);
        } else if (selectedPin !== pin) {
            const startPos = selectedPin.getAbsolutePosition();
            const endPos = pin.getAbsolutePosition();

            const wire = new Konva.Line({
                points: getOrthogonalPoints(startPos, endPos),
                                        stroke: pinType === 'electrical' ? '#888888' : '#0288d1',
                                        strokeWidth: 2.5,
                                        hitStrokeWidth: 12
            });

            layer.add(wire);
            window.wires.push({ wire, startPin: selectedPin, endPin: pin, powered: false });

            if (tempLine) tempLine.destroy();
            tempLine = null;
            selectedPin = null;
            layer.batchDraw();
        }
    });

    pin.on('mouseenter', () => {
        if (!isSimulating) {
            document.body.style.cursor = 'crosshair';
            pin.radius(8);
            layer.batchDraw();
        }
    });

    pin.on('mouseleave', () => {
        document.body.style.cursor = 'default';
        pin.radius(6);
        layer.batchDraw();
    });

    group.add(pin);
    return pin;
}

function updateWires() {
    window.wires.forEach(({ wire, startPin, endPin }) => {
        const p1 = startPin.getAbsolutePosition();
        const p2 = endPin.getAbsolutePosition();
        wire.points(getOrthogonalPoints(p1, p2));
    });
}

function setupGroupDrag(group) {
    group.on('dragmove', () => {
        updateWires();
        updateSelectionBox();
        layer.batchDraw();
    });
    group.on('dragend', () => {
        group.position(snapToGrid(group.position()));
        updateWires();
        updateSelectionBox();
        layer.batchDraw();
    });
}

function getDefaultName(type) {
    const count = window.components.filter(c => c.type === type).length + 1;
    switch (type) {
        case 'PUSHBUTTON_NO': return `S${count}`;
        case 'PUSHBUTTON_NC': return `S${count}`;
        case 'RELAY': return `K${count}`;
        case 'RELAY_CONTACT_NO': return `K1`;
        case 'RELAY_CONTACT_NC': return `K1`;
        case 'TIMER_TON': return `KT${count}`;
        case 'TIMER_CONTACT_NO': return `KT1`;
        case 'VALVE32': return `Y${count}`;
        case 'CYLINDER': return `A${count}`;
        default: return `COMP${count}`;
    }
}

// ==========================================
// GENERADORES DE COMPONENTES
// ==========================================
function createPowerSupply(x, y) {
    const group = new Konva.Group({ x, y, draggable: !isSimulating });
    group.type = 'POWER';

    addHitArea(group, 80, 40);

    const line24V = new Konva.Line({ points: [0, 0, 40, 0], stroke: '#ef5350', strokeWidth: 3 });
    const text24V = new Konva.Text({ x: 45, y: -5, text: '+24V', fill: '#ef5350', fontSize: 12, fontStyle: 'bold' });

    const line0V = new Konva.Line({ points: [0, 40, 40, 40], stroke: '#42a5f5', strokeWidth: 3 });
    const text0V = new Konva.Text({ x: 45, y: 35, text: '0V', fill: '#42a5f5', fontSize: 12, fontStyle: 'bold' });

    group.add(line24V, text24V, line0V, text0V);

    group.pin24V = createPin(group, 20, 0, 'electrical', '24V');
    group.pin0V = createPin(group, 20, 40, 'electrical', '0V');

    setupGroupDrag(group);
    layer.add(group);
    window.components.push(group);
    layer.batchDraw();
}

function createPushButtonNO(x, y) {
    const tag = prompt("Nombre del Pulsador NA:", getDefaultName('PUSHBUTTON_NO')) || 'S1';

    const group = new Konva.Group({ x, y, draggable: !isSimulating });
    group.type = 'PUSHBUTTON_NO';
    group.tag = tag;
    group.isClosed = false;

    addHitArea(group, 70, 60);

    const topTerm = new Konva.Line({ points: [20, 0, 20, 15], stroke: '#ffffff', strokeWidth: 2 });
    const botTerm = new Konva.Line({ points: [20, 35, 20, 50], stroke: '#ffffff', strokeWidth: 2 });
    const dot1 = new Konva.Circle({ x: 20, y: 15, radius: 3, fill: '#ffffff' });
    const dot2 = new Konva.Circle({ x: 20, y: 35, radius: 3, fill: '#ffffff' });

    const bridge = new Konva.Line({ points: [28, 12, 28, 38], stroke: '#4caf50', strokeWidth: 2.5 });
    const capTop = new Konva.Line({ points: [23, 12, 28, 12], stroke: '#4caf50', strokeWidth: 2 });
    const capBot = new Konva.Line({ points: [23, 38, 28, 38], stroke: '#4caf50', strokeWidth: 2 });

    const actuator = new Konva.Line({ points: [28, 25, 42, 25], stroke: '#888888', strokeWidth: 1.5, dash: [2, 2] });
    const buttonCap = new Konva.Line({ points: [42, 18, 42, 32], stroke: '#4caf50', strokeWidth: 3 });

    const label = new Konva.Text({ x: 48, y: 18, text: tag, fontSize: 14, fill: '#4caf50', fontStyle: 'bold' });

    group.add(topTerm, botTerm, dot1, dot2, bridge, capTop, capBot, actuator, buttonCap, label);
    group.bridge = bridge;

    group.pinIn = createPin(group, 20, 0, 'electrical', 'in');
    group.pinOut = createPin(group, 20, 50, 'electrical', 'out');

    group.on('mousedown', (e) => {
        if (!isSimulating || e.evt.button !== 0) return;
        group.isClosed = true;
        group.bridge.points([20, 12, 20, 38]);
        solveCircuit();
        layer.batchDraw();
    });

    stage.on('mouseup', (e) => {
        if (!isSimulating || !group.isClosed || e.evt.button !== 0) return;
        group.isClosed = false;
        group.bridge.points([28, 12, 28, 38]);
        solveCircuit();
        layer.batchDraw();
    });

    setupGroupDrag(group);
    layer.add(group);
    window.components.push(group);
    layer.batchDraw();
}

function createPushButtonNC(x, y) {
    const tag = prompt("Nombre del Pulsador NC:", getDefaultName('PUSHBUTTON_NC')) || 'S0';

    const group = new Konva.Group({ x, y, draggable: !isSimulating });
    group.type = 'PUSHBUTTON_NC';
    group.tag = tag;
    group.isClosed = true;

    addHitArea(group, 70, 60);

    const topTerm = new Konva.Line({ points: [20, 0, 20, 15], stroke: '#ffffff', strokeWidth: 2 });
    const botTerm = new Konva.Line({ points: [20, 35, 20, 50], stroke: '#ffffff', strokeWidth: 2 });
    const dot1 = new Konva.Circle({ x: 20, y: 15, radius: 3, fill: '#ffffff' });
    const dot2 = new Konva.Circle({ x: 20, y: 35, radius: 3, fill: '#ffffff' });

    const bridge = new Konva.Line({ points: [20, 15, 20, 35], stroke: '#ef5350', strokeWidth: 2.5 });

    const actuator = new Konva.Line({ points: [20, 25, 38, 25], stroke: '#888888', strokeWidth: 1.5, dash: [2, 2] });
    const buttonCap = new Konva.Line({ points: [38, 18, 38, 32], stroke: '#ef5350', strokeWidth: 3 });

    const label = new Konva.Text({ x: 44, y: 18, text: tag, fontSize: 14, fill: '#ef5350', fontStyle: 'bold' });

    group.add(topTerm, botTerm, dot1, dot2, bridge, actuator, buttonCap, label);
    group.bridge = bridge;

    group.pinIn = createPin(group, 20, 0, 'electrical', 'in');
    group.pinOut = createPin(group, 20, 50, 'electrical', 'out');

    group.on('mousedown', (e) => {
        if (!isSimulating || e.evt.button !== 0) return;
        group.isClosed = false;
        group.bridge.points([28, 15, 28, 35]);
        solveCircuit();
        layer.batchDraw();
    });

    stage.on('mouseup', (e) => {
        if (!isSimulating || group.isClosed || e.evt.button !== 0) return;
        group.isClosed = true;
        group.bridge.points([20, 15, 20, 35]);
        solveCircuit();
        layer.batchDraw();
    });

    setupGroupDrag(group);
    layer.add(group);
    window.components.push(group);
    layer.batchDraw();
}

function createRelay(x, y) {
    const tag = prompt("Nombre de la Bobina del Relé:", getDefaultName('RELAY')) || 'K1';

    const group = new Konva.Group({ x, y, draggable: !isSimulating });
    group.type = 'RELAY';
    group.tag = tag;
    group.isEnergized = false;

    addHitArea(group, 50, 70);

    const box = new Konva.Rect({
        x: 0, y: 10, width: 40, height: 50, stroke: '#007acc', strokeWidth: 2, fill: '#1e1e1e', cornerRadius: 2,
    });

    const diagLine = new Konva.Line({ points: [0, 20, 40, 20], stroke: '#007acc', strokeWidth: 1.5 });

    const lineA1 = new Konva.Line({ points: [20, 0, 20, 10], stroke: '#ffffff', strokeWidth: 2 });
    const lineA2 = new Konva.Line({ points: [20, 60, 20, 70], stroke: '#ffffff', strokeWidth: 2 });

    const labelA1 = new Konva.Text({ x: 5, y: 0, text: 'A1', fontSize: 9, fill: '#aaaaaa' });
    const labelA2 = new Konva.Text({ x: 5, y: 60, text: 'A2', fontSize: 9, fill: '#aaaaaa' });

    const label = new Konva.Text({ x: 10, y: 30, text: tag, fontSize: 15, fill: '#ffffff', fontStyle: 'bold' });

    group.add(box, diagLine, lineA1, lineA2, labelA1, labelA2, label);
    group.box = box;

    group.pinA1 = createPin(group, 20, 0, 'electrical', 'in');
    group.pinA2 = createPin(group, 20, 70, 'electrical', 'out');

    setupGroupDrag(group);
    layer.add(group);
    window.components.push(group);
    layer.batchDraw();
}

function createRelayContactNO(x, y) {
    const tag = prompt("Nombre del Relé al que pertenece este Contacto NA:", getDefaultName('RELAY_CONTACT_NO')) || 'K1';

    const group = new Konva.Group({ x, y, draggable: !isSimulating });
    group.type = 'RELAY_CONTACT_NO';
    group.tag = tag;
    group.isClosed = false;

    addHitArea(group, 50, 50);

    const topTerm = new Konva.Line({ points: [15, 0, 15, 15], stroke: '#ffcc00', strokeWidth: 2 });
    const botTerm = new Konva.Line({ points: [15, 35, 15, 50], stroke: '#ffcc00', strokeWidth: 2 });
    const dot1 = new Konva.Circle({ x: 15, y: 15, radius: 2.5, fill: '#ffcc00' });
    const dot2 = new Konva.Circle({ x: 15, y: 35, radius: 2.5, fill: '#ffcc00' });

    const bridge = new Konva.Line({ points: [15, 35, 25, 15], stroke: '#ffcc00', strokeWidth: 2.5 });
    const label = new Konva.Text({ x: 28, y: 18, text: tag, fontSize: 13, fill: '#ffcc00', fontStyle: 'bold' });

    group.add(topTerm, botTerm, dot1, dot2, bridge, label);
    group.bridge = bridge;

    group.pinIn = createPin(group, 15, 0, 'electrical', 'in');
    group.pinOut = createPin(group, 15, 50, 'electrical', 'out');

    setupGroupDrag(group);
    layer.add(group);
    window.components.push(group);
    layer.batchDraw();
}

function createRelayContactNC(x, y) {
    const tag = prompt("Nombre del Relé al que pertenece este Contacto NC:", getDefaultName('RELAY_CONTACT_NC')) || 'K1';

    const group = new Konva.Group({ x, y, draggable: !isSimulating });
    group.type = 'RELAY_CONTACT_NC';
    group.tag = tag;
    group.isClosed = true;

    addHitArea(group, 50, 50);

    const topTerm = new Konva.Line({ points: [15, 0, 15, 15], stroke: '#ffcc00', strokeWidth: 2 });
    const botTerm = new Konva.Line({ points: [15, 35, 15, 50], stroke: '#ffcc00', strokeWidth: 2 });
    const dot1 = new Konva.Circle({ x: 15, y: 15, radius: 2.5, fill: '#ffcc00' });
    const dot2 = new Konva.Circle({ x: 15, y: 35, radius: 2.5, fill: '#ffcc00' });

    const bridge = new Konva.Line({ points: [15, 15, 15, 35], stroke: '#ffcc00', strokeWidth: 2.5 });
    const flag = new Konva.Line({ points: [10, 15, 15, 15], stroke: '#ffcc00', strokeWidth: 2 });
    const label = new Konva.Text({ x: 28, y: 18, text: tag, fontSize: 13, fill: '#ffcc00', fontStyle: 'bold' });

    group.add(topTerm, botTerm, dot1, dot2, bridge, flag, label);
    group.bridge = bridge;

    group.pinIn = createPin(group, 15, 0, 'electrical', 'in');
    group.pinOut = createPin(group, 15, 50, 'electrical', 'out');

    setupGroupDrag(group);
    layer.add(group);
    window.components.push(group);
    layer.batchDraw();
}

function createTimerTON(x, y) {
    const tag = prompt("Nombre del Temporizador:", getDefaultName('TIMER_TON')) || 'KT1';
    if (!tag) return;

    const inputTime = prompt("Tiempo de retardo (segundos):", "3");
    const seconds = parseFloat(inputTime) || 3;

    const group = new Konva.Group({ x, y, draggable: !isSimulating });
    group.type = 'TIMER_TON';
    group.tag = tag;
    group.presetTime = seconds;
    group.startTime = null;
    group.isEnergized = false;
    group.isDone = false;

    addHitArea(group, 60, 70);

    const box = new Konva.Rect({
        x: 0, y: 10, width: 45, height: 50, stroke: '#ff9800', strokeWidth: 2, fill: '#1e1e1e', cornerRadius: 2,
    });

    const crossLine = new Konva.Line({ points: [0, 20, 45, 20], stroke: '#ff9800', strokeWidth: 1.5 });
    const lineA1 = new Konva.Line({ points: [22.5, 0, 22.5, 10], stroke: '#ffffff', strokeWidth: 2 });
    const lineA2 = new Konva.Line({ points: [22.5, 60, 22.5, 70], stroke: '#ffffff', strokeWidth: 2 });

    const labelA1 = new Konva.Text({ x: 5, y: 0, text: 'A1', fontSize: 9, fill: '#aaaaaa' });
    const labelA2 = new Konva.Text({ x: 5, y: 60, text: 'A2', fontSize: 9, fill: '#aaaaaa' });

    const label = new Konva.Text({ x: 8, y: 23, text: tag, fontSize: 13, fill: '#ffffff', fontStyle: 'bold' });
    const timerText = new Konva.Text({ x: 8, y: 42, text: `${seconds}s`, fontSize: 11, fill: '#ff9800' });

    group.add(box, crossLine, lineA1, lineA2, labelA1, labelA2, label, timerText);
    group.box = box;
    group.timerText = timerText;

    group.pinA1 = createPin(group, 22.5, 0, 'electrical', 'in');
    group.pinA2 = createPin(group, 22.5, 70, 'electrical', 'out');

    setupGroupDrag(group);
    layer.add(group);
    window.components.push(group);
    layer.batchDraw();
}

function createTimerContactNO(x, y) {
    const tag = prompt("Nombre del Temporizador asociado:", getDefaultName('TIMER_CONTACT_NO')) || 'KT1';

    const group = new Konva.Group({ x, y, draggable: !isSimulating });
    group.type = 'TIMER_CONTACT_NO';
    group.tag = tag;
    group.isClosed = false;

    addHitArea(group, 50, 50);

    const topTerm = new Konva.Line({ points: [15, 0, 15, 15], stroke: '#ff9800', strokeWidth: 2 });
    const botTerm = new Konva.Line({ points: [15, 35, 15, 50], stroke: '#ff9800', strokeWidth: 2 });
    const dot1 = new Konva.Circle({ x: 15, y: 15, radius: 2.5, fill: '#ff9800' });
    const dot2 = new Konva.Circle({ x: 15, y: 35, radius: 2.5, fill: '#ff9800' });

    const bridge = new Konva.Line({ points: [15, 35, 25, 15], stroke: '#ff9800', strokeWidth: 2.5 });
    // Símbolo paraguas / retardo TON
    const arc = new Konva.Line({ points: [25, 15, 28, 20, 22, 20, 25, 15], stroke: '#ff9800', strokeWidth: 1.5 });

    const label = new Konva.Text({ x: 30, y: 18, text: tag, fontSize: 13, fill: '#ff9800', fontStyle: 'bold' });

    group.add(topTerm, botTerm, dot1, dot2, bridge, arc, label);
    group.bridge = bridge;

    group.pinIn = createPin(group, 15, 0, 'electrical', 'in');
    group.pinOut = createPin(group, 15, 50, 'electrical', 'out');

    setupGroupDrag(group);
    layer.add(group);
    window.components.push(group);
    layer.batchDraw();
}

function createValve32(x, y) {
    const tag = prompt("Nombre del Solenoide/Válvula:", getDefaultName('VALVE32')) || 'Y1';

    const group = new Konva.Group({ x, y, draggable: !isSimulating });
    group.type = 'VALVE32';
    group.tag = tag;

    addHitArea(group, 70, 40);

    const box1 = new Konva.Rect({ x: 0, y: 0, width: 30, height: 30, stroke: '#4caf50', strokeWidth: 2, fill: '#252526' });
    const box2 = new Konva.Rect({ x: 30, y: 0, width: 30, height: 30, stroke: '#4caf50', strokeWidth: 2, fill: '#252526' });
    const arrow = new Konva.Arrow({ points: [45, 25, 45, 5], pointerLength: 4, pointerWidth: 4, fill: '#4caf50', stroke: '#4caf50', strokeWidth: 1.5 });
    const block = new Konva.Line({ points: [10, 25, 20, 25], stroke: '#ef5350', strokeWidth: 2 });

    const solenoid = new Konva.Rect({ x: -15, y: 7.5, width: 15, height: 15, stroke: '#ffcc00', strokeWidth: 1.5 });
    const solLabel = new Konva.Text({ x: -13, y: -7, text: tag, fontSize: 10, fill: '#ffcc00' });

    group.add(box1, box2, arrow, block, solenoid, solLabel);
    group.solenoid = solenoid;

    group.pinAirIn = createPin(group, 45, 30, 'pneumatic', 'in');
    group.pinAirOut = createPin(group, 45, 0, 'pneumatic', 'out');
    group.pinSol = createPin(group, -7.5, 7.5, 'electrical', 'solenoid');

    setupGroupDrag(group);
    layer.add(group);
    window.components.push(group);
    layer.batchDraw();
}

function createCylinder(x, y) {
    const tag = prompt("Nombre del Cilindro:", getDefaultName('CYLINDER')) || 'A1';

    const group = new Konva.Group({ x, y, draggable: !isSimulating });
    group.type = 'CYLINDER';
    group.tag = tag;

    addHitArea(group, 130, 40);

    const body = new Konva.Rect({ width: 80, height: 30, stroke: '#4caf50', strokeWidth: 2, fill: '#252526' });
    const rod = new Konva.Rect({ x: 80, y: 10, width: 40, height: 10, fill: '#888' });
    const label = new Konva.Text({ x: 5, y: 8, text: tag, fontSize: 12, fill: '#ffffff' });

    group.add(body, rod, label);
    group.rod = rod;

    group.pinAir = createPin(group, 20, 30, 'pneumatic', 'in');

    setupGroupDrag(group);
    layer.add(group);
    window.components.push(group);
    layer.batchDraw();
}

// ==========================================
// SIMULACIÓN
// ==========================================
function updateTimers() {
    if (!isSimulating) return;

    let stateChanged = false;
    const now = Date.now();

    window.components.forEach(c => {
        if (c.type === 'TIMER_TON') {
            if (c.isEnergized) {
                if (!c.startTime) c.startTime = now;
                const elapsed = (now - c.startTime) / 1000;

                if (c.timerText) {
                    const remaining = Math.max(0, c.presetTime - elapsed).toFixed(1);
                    c.timerText.text(`${remaining}s`);
                }

                if (elapsed >= c.presetTime && !c.isDone) {
                    c.isDone = true;
                    stateChanged = true;
                }
            } else {
                if (c.startTime !== null || c.isDone) {
                    c.startTime = null;
                    c.isDone = false;
                    if (c.timerText) c.timerText.text(`${c.presetTime}s`);
                    stateChanged = true;
                }
            }
        }
    });

    if (stateChanged) {
        solveCircuit();
    } else {
        layer.batchDraw();
    }
}

function solveCircuit() {
    if (!isSimulating) return;

    window.wires.forEach(w => {
        w.powered = false;
        w.wire.stroke(w.startPin.pinType === 'electrical' ? '#888888' : '#0288d1');
    });

    window.components.forEach(c => {
        if (c.type === 'RELAY') {
            c.isEnergized = false;
            if (c.box) c.box.fill('#1e1e1e');
        }
        if (c.type === 'TIMER_TON') {
            c.isEnergized = false;
            if (c.box) c.box.fill('#1e1e1e');
        }
        if (c.type === 'VALVE32' && c.solenoid) c.solenoid.fill('transparent');
        if (c.type === 'CYLINDER' && c.rod) c.rod.x(80);
    });

        const powerSupplies = window.components.filter(c => c.type === 'POWER');

        powerSupplies.forEach(ps => {
            const startPin = ps.pin24V;
            window.wires.forEach(w => {
                if (w.startPin === startPin || w.endPin === startPin) {
                    const nextPin = w.startPin === startPin ? w.endPin : w.startPin;
                    propagateElectrical(nextPin, w);
                }
            });
        });

        let stateChanged = false;

        window.components.forEach(c => {
            if (c.type === 'RELAY_CONTACT_NO') {
                const parentRelay = window.components.find(r => r.type === 'RELAY' && r.tag === c.tag);
                const shouldClose = !!(parentRelay && parentRelay.isEnergized);
                if (c.isClosed !== shouldClose) {
                    c.isClosed = shouldClose;
                    c.bridge.points(shouldClose ? [15, 35, 15, 15] : [15, 35, 25, 15]);
                    stateChanged = true;
                }
            }
            if (c.type === 'RELAY_CONTACT_NC') {
                const parentRelay = window.components.find(r => r.type === 'RELAY' && r.tag === c.tag);
                const shouldClose = !(parentRelay && parentRelay.isEnergized);
                if (c.isClosed !== shouldClose) {
                    c.isClosed = shouldClose;
                    c.bridge.points(shouldClose ? [15, 15, 15, 35] : [15, 35, 25, 15]);
                    stateChanged = true;
                }
            }
            if (c.type === 'TIMER_CONTACT_NO') {
                const parentTimer = window.components.find(r => r.type === 'TIMER_TON' && r.tag === c.tag);
                const shouldClose = !!(parentTimer && parentTimer.isDone);
                if (c.isClosed !== shouldClose) {
                    c.isClosed = shouldClose;
                    c.bridge.points(shouldClose ? [15, 35, 15, 15] : [15, 35, 25, 15]);
                    stateChanged = true;
                }
            }
        });

        if (stateChanged) {
            solveCircuit();
        } else {
            layer.batchDraw();
        }
}

function propagateElectrical(currentPin, activeWire) {
    activeWire.powered = true;
    activeWire.wire.stroke('#ff3333');

    const parent = currentPin.parentComponent;

    if ((parent.type === 'PUSHBUTTON_NO' || parent.type === 'PUSHBUTTON_NC' ||
        parent.type === 'RELAY_CONTACT_NO' || parent.type === 'RELAY_CONTACT_NC' ||
        parent.type === 'TIMER_CONTACT_NO') && parent.isClosed) {
        const otherPin = currentPin === parent.pinIn ? parent.pinOut : parent.pinIn;
    findAndPropagate(otherPin);
        }

        if (parent.type === 'RELAY') {
            parent.isEnergized = true;
            if (parent.box) parent.box.fill('#ffcc00');
        }

        if (parent.type === 'TIMER_TON') {
            parent.isEnergized = true;
            if (parent.box) parent.box.fill('#ff9800');
        }

        if (parent.type === 'VALVE32' && currentPin === parent.pinSol) {
            if (parent.solenoid) parent.solenoid.fill('#ffcc00');
            propagatePneumatic(parent);
        }
}

function findAndPropagate(pin) {
    window.wires.forEach(w => {
        if (!w.powered && (w.startPin === pin || w.endPin === pin)) {
            const nextPin = w.startPin === pin ? w.endPin : w.startPin;
            propagateElectrical(nextPin, w);
        }
    });
}

function propagatePneumatic(valve) {
    const outPin = valve.pinAirOut;
    window.wires.forEach(w => {
        if (w.startPin === outPin || w.endPin === outPin) {
            w.wire.stroke('#00e5ff');
            const targetPin = w.startPin === outPin ? w.endPin : w.startPin;
            if (targetPin.parentComponent && targetPin.parentComponent.type === 'CYLINDER') {
                if (targetPin.parentComponent.rod) {
                    targetPin.parentComponent.rod.x(110);
                }
            }
        }
    });
}

function setSimulationMode(active) {
    isSimulating = active;
    clearSelection();

    window.components.forEach(c => c.draggable(!active));

    const btnPlay = document.getElementById('btn-play');
    const btnStop = document.getElementById('btn-stop');

    if (btnPlay) btnPlay.style.display = active ? 'none' : 'inline-block';
    if (btnStop) btnStop.style.display = active ? 'inline-block' : 'none';

    if (active) {
        simulationInterval = setInterval(updateTimers, 100);
    } else {
        if (simulationInterval) {
            clearInterval(simulationInterval);
            simulationInterval = null;
        }

        window.components.forEach(c => {
            if (c.type === 'PUSHBUTTON_NO') {
                c.isClosed = false;
                if (c.bridge) {
                    c.bridge.x(0);
                    c.bridge.points([28, 12, 28, 38]);
                }
            }
            if (c.type === 'PUSHBUTTON_NC') {
                c.isClosed = true;
                if (c.bridge) {
                    c.bridge.x(0);
                    c.bridge.points([20, 15, 20, 35]);
                }
            }
            if (c.type === 'RELAY_CONTACT_NO') {
                c.isClosed = false;
                if (c.bridge) c.bridge.points([15, 35, 25, 15]);
            }
            if (c.type === 'RELAY_CONTACT_NC') {
                c.isClosed = true;
                if (c.bridge) c.bridge.points([15, 15, 15, 35]);
            }
            if (c.type === 'TIMER_TON') {
                c.startTime = null;
                c.isDone = false;
                c.isEnergized = false;
                if (c.timerText) c.timerText.text(`${c.presetTime}s`);
            }
            if (c.type === 'TIMER_CONTACT_NO') {
                c.isClosed = false;
                if (c.bridge) c.bridge.points([15, 35, 25, 15]);
            }
        });
    }
    solveCircuit();
}

// ==========================================
// EVENTOS Y EVENT LISTENERS
// ==========================================
document.addEventListener('DOMContentLoaded', () => {
    const btnPower = document.getElementById('add-power');
    const btnPushNO = document.getElementById('add-pushbutton');
    const btnPushNC = document.getElementById('add-pushbutton-nc');
    const btnRelay = document.getElementById('add-relay');
    const btnContactNO = document.getElementById('add-contact-no');
    const btnContactNC = document.getElementById('add-contact-nc');
    const btnTimerTON = document.getElementById('add-timer-ton');
    const btnTimerContactNO = document.getElementById('add-timer-contact-no');
    const btnValve = document.getElementById('add-valve32');
    const btnCyl = document.getElementById('add-cylinder');

    if (btnPower) btnPower.addEventListener('click', () => { if (!isSimulating) createPowerSupply(60, 60); });
    if (btnPushNO) btnPushNO.addEventListener('click', () => { if (!isSimulating) createPushButtonNO(180, 60); });
    if (btnPushNC) btnPushNC.addEventListener('click', () => { if (!isSimulating) createPushButtonNC(180, 140); });
    if (btnRelay) btnRelay.addEventListener('click', () => { if (!isSimulating) createRelay(300, 60); });
    if (btnContactNO) btnContactNO.addEventListener('click', () => { if (!isSimulating) createRelayContactNO(300, 160); });
    if (btnContactNC) btnContactNC.addEventListener('click', () => { if (!isSimulating) createRelayContactNC(300, 240); });
    if (btnTimerTON) btnTimerTON.addEventListener('click', () => { if (!isSimulating) createTimerTON(420, 60); });
    if (btnTimerContactNO) btnTimerContactNO.addEventListener('click', () => { if (!isSimulating) createTimerContactNO(420, 160); });
    if (btnValve) btnValve.addEventListener('click', () => { if (!isSimulating) createValve32(540, 160); });
    if (btnCyl) btnCyl.addEventListener('click', () => { if (!isSimulating) createCylinder(650, 160); });

    const btnPlay = document.getElementById('btn-play');
    const btnStop = document.getElementById('btn-stop');
    const btnClear = document.getElementById('btn-clear');

    if (btnPlay) btnPlay.addEventListener('click', () => setSimulationMode(true));
    if (btnStop) btnStop.addEventListener('click', () => setSimulationMode(false));

    if (btnClear) {
        btnClear.addEventListener('click', () => {
            if (isSimulating) setSimulationMode(false);
            clearSelection();
            layer.destroyChildren();
            window.wires.length = 0;
            window.components.length = 0;
            drawGrid();
            layer.batchDraw();
        });
    }
});

stage.on('mousemove', () => {
    if (selectedPin && tempLine) {
        const startPos = selectedPin.getAbsolutePosition();
        const mousePos = stage.getPointerPosition();
        if (mousePos) {
            tempLine.points(getOrthogonalPoints(startPos, mousePos));
            layer.batchDraw();
        }
    }
});

// Selección de Componentes y Cables
stage.on('click tap', (e) => {
    if (isSimulating) return;

    if (selectedPin && e.target === stage) {
        if (tempLine) tempLine.destroy();
        tempLine = null;
        selectedPin = null;
        clearSelection();
        return;
    }

    if (e.target === stage) {
        clearSelection();
        return;
    }

    const target = e.target;
    if (target.isPin) return;

    // Cable seleccionado
    if (target.className === 'Line' && !target.parentComponent) {
        clearSelection();
        selectedElement = target;
        selectedElement.stroke('#ff0055');
        layer.batchDraw();
        return;
    }

    // Componente seleccionado
    let curr = target;
    let foundGroup = null;

    while (curr && curr !== stage) {
        if (window.components.includes(curr)) {
            foundGroup = curr;
            break;
        }
        curr = curr.getParent();
    }

    if (foundGroup) {
        clearSelection();
        selectedElement = foundGroup;
        updateSelectionBox();
        layer.batchDraw();
    }
});

// Clic derecho para BORRADO INMEDIATO del objeto bajo el puntero
stage.on('contentContextmenu', (e) => {
    e.evt.preventDefault();
    if (isSimulating) return;

    const target = e.target;
    if (target.isPin) return;

    if (target.className === 'Line' && !target.parentComponent) {
        window.deleteElement(target);
        return;
    }

    let curr = target;
    let foundGroup = null;

    while (curr && curr !== stage) {
        if (window.components.includes(curr)) {
            foundGroup = curr;
            break;
        }
        curr = curr.getParent();
    }

    if (foundGroup) {
        window.deleteElement(foundGroup);
    }
});

// Escuchador Global Teclado
window.addEventListener('keydown', (e) => {
    if (isSimulating) return;

    if (e.key === 'Escape') {
        if (tempLine) tempLine.destroy();
        tempLine = null;
        selectedPin = null;
        clearSelection();
        return;
    }

    if ((e.key === 'Delete' || e.key === 'Backspace') && selectedElement) {
        e.preventDefault();
        window.deleteElement(selectedElement);
    }
});
