const container = document.getElementById('canvas-container');

const stage = new Konva.Stage({
    container: 'canvas-container',
    width: container ? container.clientWidth : 800,
    height: container ? container.clientHeight : 600,
});

const layer = new Konva.Layer();
stage.add(layer);

// Estados globales
let isSimulating = false;
let selectedPin = null;
let tempLine = null;

const wires = [];
const components = [];

// Dibujar Rejilla CAD
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

// Creación de Terminales Interactivos
function createPin(group, relativeX, relativeY, pinType = 'electrical', role = 'generic') {
    const color = pinType === 'electrical' ? '#ff5555' : '#00bcd4';

    const pin = new Konva.Circle({
        x: relativeX, y: relativeY, radius: 5, fill: color, stroke: '#ffffff', strokeWidth: 1,
    });

    pin.pinType = pinType;
    pin.role = role;
    pin.parentComponent = group;

    pin.on('mousedown', (e) => {
        if (isSimulating) return;
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
            });

            layer.add(wire);
            wires.push({ wire, startPin: selectedPin, endPin: pin, powered: false });

            if (tempLine) tempLine.destroy();
            tempLine = null;
            selectedPin = null;
            layer.batchDraw();
        }
    });

    pin.on('mouseenter', () => {
        if (!isSimulating) {
            document.body.style.cursor = 'crosshair';
            pin.radius(7);
            layer.batchDraw();
        }
    });

    pin.on('mouseleave', () => {
        document.body.style.cursor = 'default';
        pin.radius(5);
        layer.batchDraw();
    });

    group.add(pin);
    return pin;
}

function updateWires() {
    wires.forEach(({ wire, startPin, endPin }) => {
        const p1 = startPin.getAbsolutePosition();
        const p2 = endPin.getAbsolutePosition();
        wire.points(getOrthogonalPoints(p1, p2));
    });
}

function setupGroupDrag(group) {
    group.on('dragmove', () => { updateWires(); layer.batchDraw(); });
    group.on('dragend', () => { group.position(snapToGrid(group.position())); updateWires(); layer.batchDraw(); });
}

// Generador genérico de nombres predeterminados
function getDefaultName(type) {
    const count = components.filter(c => c.type === type).length + 1;
    switch (type) {
        case 'PUSHBUTTON_NO': return `S${count}`;
        case 'PUSHBUTTON_NC': return `S${count}`;
        case 'RELAY': return `K${count}`;
        case 'RELAY_CONTACT_NO': return `K1`;
        case 'RELAY_CONTACT_NC': return `K1`;
        case 'VALVE32': return `Y${count}`;
        case 'CYLINDER': return `A${count}`;
        default: return `COMP${count}`;
    }
}

// --- GENERADORES DE COMPONENTES ---

function createPowerSupply(x, y) {
    const group = new Konva.Group({ x, y, draggable: !isSimulating });
    group.type = 'POWER';

    const line24V = new Konva.Line({ points: [0, 0, 40, 0], stroke: '#ef5350', strokeWidth: 3 });
    const text24V = new Konva.Text({ x: 45, y: -5, text: '+24V', fill: '#ef5350', fontSize: 12, fontStyle: 'bold' });

    const line0V = new Konva.Line({ points: [0, 40, 40, 40], stroke: '#42a5f5', strokeWidth: 3 });
    const text0V = new Konva.Text({ x: 45, y: 35, text: '0V', fill: '#42a5f5', fontSize: 12, fontStyle: 'bold' });

    group.add(line24V, text24V, line0V, text0V);

    group.pin24V = createPin(group, 20, 0, 'electrical', '24V');
    group.pin0V = createPin(group, 20, 40, 'electrical', '0V');

    setupGroupDrag(group);
    layer.add(group);
    components.push(group);
    layer.batchDraw();
}

// Pulsador Normalmente Abierto (NO)
function createPushButtonNO(x, y) {
    const tag = prompt("Nombre del Pulsador NA:", getDefaultName('PUSHBUTTON_NO')) || 'S1';

    const group = new Konva.Group({ x, y, draggable: !isSimulating });
    group.type = 'PUSHBUTTON_NO';
    group.tag = tag;
    group.isClosed = false;

    const topTerm = new Konva.Line({ points: [15, 0, 15, 15], stroke: '#ffffff', strokeWidth: 2 });
    const botTerm = new Konva.Line({ points: [15, 35, 15, 50], stroke: '#ffffff', strokeWidth: 2 });
    const dot1 = new Konva.Circle({ x: 15, y: 15, radius: 2, fill: '#ffffff' });
    const dot2 = new Konva.Circle({ x: 15, y: 35, radius: 2, fill: '#ffffff' });

    const bridge = new Konva.Line({ points: [5, 12, 22, 12], stroke: '#ffffff', strokeWidth: 2 });
    const actuator = new Konva.Line({ points: [13.5, 0, 13.5, 12], stroke: '#ffffff', strokeWidth: 1.5, dash: [2, 2] });
    const label = new Konva.Text({ x: 30, y: 18, text: tag, fontSize: 14, fill: '#ffffff' });

    group.add(topTerm, botTerm, dot1, dot2, bridge, actuator, label);
    group.bridge = bridge;

    group.pinIn = createPin(group, 15, 0, 'electrical', 'in');
    group.pinOut = createPin(group, 15, 50, 'electrical', 'out');

    group.on('mousedown', () => {
        if (!isSimulating) return;
        group.isClosed = true;
        group.bridge.y(3);
        solveCircuit();
        layer.batchDraw();
    });

    stage.on('mouseup', () => {
        if (!isSimulating || !group.isClosed) return;
        group.isClosed = false;
        group.bridge.y(0);
        solveCircuit();
        layer.batchDraw();
    });

    setupGroupDrag(group);
    layer.add(group);
    components.push(group);
    layer.batchDraw();
}

// Pulsador Normalmente Cerrado (NC)
function createPushButtonNC(x, y) {
    const tag = prompt("Nombre del Pulsador NC:", getDefaultName('PUSHBUTTON_NC')) || 'S0';

    const group = new Konva.Group({ x, y, draggable: !isSimulating });
    group.type = 'PUSHBUTTON_NC';
    group.tag = tag;
    group.isClosed = true;

    const topTerm = new Konva.Line({ points: [15, 0, 15, 15], stroke: '#ffffff', strokeWidth: 2 });
    const botTerm = new Konva.Line({ points: [15, 35, 15, 50], stroke: '#ffffff', strokeWidth: 2 });
    const dot1 = new Konva.Circle({ x: 15, y: 15, radius: 2, fill: '#ffffff' });
    const dot2 = new Konva.Circle({ x: 15, y: 35, radius: 2, fill: '#ffffff' });

    const bridge = new Konva.Line({ points: [5, 15, 22, 15], stroke: '#ffffff', strokeWidth: 2 });
    const actuator = new Konva.Line({ points: [13.5, 0, 13.5, 15], stroke: '#ffffff', strokeWidth: 1.5, dash: [2, 2] });
    const label = new Konva.Text({ x: 30, y: 18, text: tag, fontSize: 14, fill: '#ffffff' });

    group.add(topTerm, botTerm, dot1, dot2, bridge, actuator, label);
    group.bridge = bridge;

    group.pinIn = createPin(group, 15, 0, 'electrical', 'in');
    group.pinOut = createPin(group, 15, 50, 'electrical', 'out');

    group.on('mousedown', () => {
        if (!isSimulating) return;
        group.isClosed = false;
        group.bridge.y(-5);
        solveCircuit();
        layer.batchDraw();
    });

    stage.on('mouseup', () => {
        if (!isSimulating || group.isClosed) return;
        group.isClosed = true;
        group.bridge.y(0);
        solveCircuit();
        layer.batchDraw();
    });

    setupGroupDrag(group);
    layer.add(group);
    components.push(group);
    layer.batchDraw();
}

// Bobina de Relé
function createRelay(x, y) {
    const tag = prompt("Nombre de la Bobina del Relé:", getDefaultName('RELAY')) || 'K1';

    const group = new Konva.Group({ x, y, draggable: !isSimulating });
    group.type = 'RELAY';
    group.tag = tag;
    group.isEnergized = false;

    const box = new Konva.Rect({
        width: 40, height: 60, stroke: '#007acc', strokeWidth: 2, fill: '#252526', cornerRadius: 2,
    });

    const label = new Konva.Text({ x: 10, y: 22, text: tag, fontSize: 16, fill: '#ffffff' });

    group.add(box, label);
    group.box = box;

    group.pinA1 = createPin(group, 20, 0, 'electrical', 'in');
    group.pinA2 = createPin(group, 20, 60, 'electrical', 'out');

    setupGroupDrag(group);
    layer.add(group);
    components.push(group);
    layer.batchDraw();
}

// Contacto Auxiliar de Relé normalmente Abierto (NO)
function createRelayContactNO(x, y) {
    const tag = prompt("Nombre del Relé al que pertenece este Contacto NA:", getDefaultName('RELAY_CONTACT_NO')) || 'K1';

    const group = new Konva.Group({ x, y, draggable: !isSimulating });
    group.type = 'RELAY_CONTACT_NO';
    group.tag = tag;
    group.isClosed = false;

    const topTerm = new Konva.Line({ points: [15, 0, 15, 15], stroke: '#ffcc00', strokeWidth: 2 });
    const botTerm = new Konva.Line({ points: [15, 35, 15, 50], stroke: '#ffcc00', strokeWidth: 2 });
    const dot1 = new Konva.Circle({ x: 15, y: 15, radius: 2, fill: '#ffcc00' });
    const dot2 = new Konva.Circle({ x: 15, y: 35, radius: 2, fill: '#ffcc00' });

    const bridge = new Konva.Line({ points: [5, 12, 22, 12], stroke: '#ffcc00', strokeWidth: 2 });
    const label = new Konva.Text({ x: 28, y: 18, text: tag, fontSize: 13, fill: '#ffcc00' });

    group.add(topTerm, botTerm, dot1, dot2, bridge, label);
    group.bridge = bridge;

    group.pinIn = createPin(group, 15, 0, 'electrical', 'in');
    group.pinOut = createPin(group, 15, 50, 'electrical', 'out');

    setupGroupDrag(group);
    layer.add(group);
    components.push(group);
    layer.batchDraw();
}

// Contacto Auxiliar de Relé normalmente Cerrado (NC)
function createRelayContactNC(x, y) {
    const tag = prompt("Nombre del Relé al que pertenece este Contacto NC:", getDefaultName('RELAY_CONTACT_NC')) || 'K1';

    const group = new Konva.Group({ x, y, draggable: !isSimulating });
    group.type = 'RELAY_CONTACT_NC';
    group.tag = tag;
    group.isClosed = true;

    const topTerm = new Konva.Line({ points: [15, 0, 15, 15], stroke: '#ffcc00', strokeWidth: 2 });
    const botTerm = new Konva.Line({ points: [15, 35, 15, 50], stroke: '#ffcc00', strokeWidth: 2 });
    const dot1 = new Konva.Circle({ x: 15, y: 15, radius: 2, fill: '#ffcc00' });
    const dot2 = new Konva.Circle({ x: 15, y: 35, radius: 2, fill: '#ffcc00' });

    const bridge = new Konva.Line({ points: [5, 15, 22, 15], stroke: '#ffcc00', strokeWidth: 2 });
    const label = new Konva.Text({ x: 28, y: 18, text: tag, fontSize: 13, fill: '#ffcc00' });

    group.add(topTerm, botTerm, dot1, dot2, bridge, label);
    group.bridge = bridge;

    group.pinIn = createPin(group, 15, 0, 'electrical', 'in');
    group.pinOut = createPin(group, 15, 50, 'electrical', 'out');

    setupGroupDrag(group);
    layer.add(group);
    components.push(group);
    layer.batchDraw();
}

// Válvula Electroneumática 3/2
function createValve32(x, y) {
    const tag = prompt("Nombre del Solenoide/Válvula:", getDefaultName('VALVE32')) || 'Y1';

    const group = new Konva.Group({ x, y, draggable: !isSimulating });
    group.type = 'VALVE32';
    group.tag = tag;

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
    components.push(group);
    layer.batchDraw();
}

// Cilindro Neumático
function createCylinder(x, y) {
    const tag = prompt("Nombre del Cilindro:", getDefaultName('CYLINDER')) || 'A1';

    const group = new Konva.Group({ x, y, draggable: !isSimulating });
    group.type = 'CYLINDER';
    group.tag = tag;

    const body = new Konva.Rect({ width: 80, height: 30, stroke: '#4caf50', strokeWidth: 2, fill: '#252526' });
    const rod = new Konva.Rect({ x: 80, y: 10, width: 40, height: 10, fill: '#888' });
    const label = new Konva.Text({ x: 5, y: 8, text: tag, fontSize: 12, fill: '#ffffff' });

    group.add(body, rod, label);
    group.rod = rod;

    group.pinAir = createPin(group, 20, 30, 'pneumatic', 'in');

    setupGroupDrag(group);
    layer.add(group);
    components.push(group);
    layer.batchDraw();
}

// --- MOTOR DE SIMULACIÓN Y LÓGICA ELECTROMECÁNICA ---

function solveCircuit() {
    if (!isSimulating) return;

    // 1. Resetear cables y componentes
    wires.forEach(w => {
        w.powered = false;
        w.wire.stroke(w.startPin.pinType === 'electrical' ? '#888888' : '#0288d1');
    });

    components.forEach(c => {
        if (c.type === 'RELAY') {
            c.isEnergized = false;
            if (c.box) c.box.fill('#252526');
        }
        if (c.type === 'VALVE32' && c.solenoid) c.solenoid.fill('transparent');
        if (c.type === 'CYLINDER' && c.rod) c.rod.x(80);
    });

        // 2. Resolver propagación inicial desde la alimentación +24V
        const powerSupplies = components.filter(c => c.type === 'POWER');

        powerSupplies.forEach(ps => {
            const startPin = ps.pin24V;
            wires.forEach(w => {
                if (w.startPin === startPin || w.endPin === startPin) {
                    const nextPin = w.startPin === startPin ? w.endPin : w.startPin;
                    propagateElectrical(nextPin, w);
                }
            });
        });

        // 3. Evaluar Estado de Contactos de Relé según el estado de sus Bobinas
        let relayStateChanged = false;

        components.forEach(c => {
            if (c.type === 'RELAY_CONTACT_NO') {
                const parentRelay = components.find(r => r.type === 'RELAY' && r.tag === c.tag);
                const shouldClose = parentRelay && parentRelay.isEnergized;
                if (c.isClosed !== shouldClose) {
                    c.isClosed = shouldClose;
                    c.bridge.y(shouldClose ? 3 : 0);
                    relayStateChanged = true;
                }
            }
            if (c.type === 'RELAY_CONTACT_NC') {
                const parentRelay = components.find(r => r.type === 'RELAY' && r.tag === c.tag);
                const shouldClose = !(parentRelay && parentRelay.isEnergized);
                if (c.isClosed !== shouldClose) {
                    c.isClosed = shouldClose;
                    c.bridge.y(shouldClose ? 0 : -5);
                    relayStateChanged = true;
                }
            }
        });

        // Si algún contacto secundario cambió de estado, volver a resolver el circuito
        if (relayStateChanged) {
            solveCircuit();
        } else {
            layer.batchDraw();
        }
}

function propagateElectrical(currentPin, activeWire) {
    activeWire.powered = true;
    activeWire.wire.stroke('#ff3333');

    const parent = currentPin.parentComponent;

    // Evaluación de continuidad según estado actual del componente
    if ((parent.type === 'PUSHBUTTON_NO' || parent.type === 'PUSHBUTTON_NC' ||
        parent.type === 'RELAY_CONTACT_NO' || parent.type === 'RELAY_CONTACT_NC') && parent.isClosed) {
        const otherPin = currentPin === parent.pinIn ? parent.pinOut : parent.pinIn;
    findAndPropagate(otherPin);
        }

        if (parent.type === 'RELAY') {
            parent.isEnergized = true;
            if (parent.box) parent.box.fill('#ffcc00');
        }

        if (parent.type === 'VALVE32' && currentPin === parent.pinSol) {
            if (parent.solenoid) parent.solenoid.fill('#ffcc00');
            propagatePneumatic(parent);
        }
}

function findAndPropagate(pin) {
    wires.forEach(w => {
        if (!w.powered && (w.startPin === pin || w.endPin === pin)) {
            const nextPin = w.startPin === pin ? w.endPin : w.startPin;
            propagateElectrical(nextPin, w);
        }
    });
}

function propagatePneumatic(valve) {
    const outPin = valve.pinAirOut;
    wires.forEach(w => {
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

    components.forEach(c => c.draggable(!active));

    const btnPlay = document.getElementById('btn-play');
    const btnStop = document.getElementById('btn-stop');

    if (btnPlay) btnPlay.style.display = active ? 'none' : 'inline-block';
    if (btnStop) btnStop.style.display = active ? 'inline-block' : 'none';

    if (!active) {
        components.forEach(c => {
            if (c.type === 'PUSHBUTTON_NO') {
                c.isClosed = false;
                if (c.bridge) c.bridge.y(0);
            }
            if (c.type === 'PUSHBUTTON_NC') {
                c.isClosed = true;
                if (c.bridge) c.bridge.y(0);
            }
            if (c.type === 'RELAY_CONTACT_NO') {
                c.isClosed = false;
                if (c.bridge) c.bridge.y(0);
            }
            if (c.type === 'RELAY_CONTACT_NC') {
                c.isClosed = true;
                if (c.bridge) c.bridge.y(0);
            }
        });
    }
    solveCircuit();
}

// Vinculación de eventos a la barra lateral
document.addEventListener('DOMContentLoaded', () => {
    const btnPower = document.getElementById('add-power');
    const btnPushNO = document.getElementById('add-pushbutton');
    const btnPushNC = document.getElementById('add-pushbutton-nc');
    const btnRelay = document.getElementById('add-relay');
    const btnContactNO = document.getElementById('add-contact-no');
    const btnContactNC = document.getElementById('add-contact-nc');
    const btnValve = document.getElementById('add-valve32');
    const btnCyl = document.getElementById('add-cylinder');

    if (btnPower) btnPower.addEventListener('click', () => { if (!isSimulating) createPowerSupply(60, 60); });
    if (btnPushNO) btnPushNO.addEventListener('click', () => { if (!isSimulating) createPushButtonNO(180, 60); });
    if (btnPushNC) btnPushNC.addEventListener('click', () => { if (!isSimulating) createPushButtonNC(180, 140); });
    if (btnRelay) btnRelay.addEventListener('click', () => { if (!isSimulating) createRelay(300, 60); });
    if (btnContactNO) btnContactNO.addEventListener('click', () => { if (!isSimulating) createRelayContactNO(300, 160); });
    if (btnContactNC) btnContactNC.addEventListener('click', () => { if (!isSimulating) createRelayContactNC(300, 240); });
    if (btnValve) btnValve.addEventListener('click', () => { if (!isSimulating) createValve32(450, 160); });
    if (btnCyl) btnCyl.addEventListener('click', () => { if (!isSimulating) createCylinder(550, 160); });

    const btnPlay = document.getElementById('btn-play');
    const btnStop = document.getElementById('btn-stop');
    const btnClear = document.getElementById('btn-clear');

    if (btnPlay) btnPlay.addEventListener('click', () => setSimulationMode(true));
    if (btnStop) btnStop.addEventListener('click', () => setSimulationMode(false));

    if (btnClear) {
        btnClear.addEventListener('click', () => {
            if (isSimulating) setSimulationMode(false);
            layer.destroyChildren();
            wires.length = 0;
            components.length = 0;
            drawGrid();
            layer.batchDraw();
        });
    }
});

// Eventos de ratón en el Stage
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

stage.on('contentContextmenu', (e) => e.evt.preventDefault());

window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && selectedPin) {
        if (tempLine) tempLine.destroy();
        tempLine = null;
        selectedPin = null;
        layer.batchDraw();
    }
});

window.addEventListener('resize', () => {
    if (container) {
        stage.width(container.clientWidth);
        stage.height(container.clientHeight);
        drawGrid();
    }
});
