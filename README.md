# ⚡ OpenSimu Web

OpenSimu Web es un simulador interactivo de circuitos eléctricos de control industrial (IEC) y esquemas neumáticos (ISO) basado en tecnologías web modernas. Diseñado para la creación, prueba y visualización dinámica de la lógica de control electromecánico en tiempo real.

---

## 🚀 Características Principales

* **Lienzo Interactivo (HTML5 Canvas):** Interfaz fluida para arrastrar, soltar y conectar componentes construida sobre **Konva.js**.
* **Simulación Electromecánica en Tiempo Real:** Motor de propagación eléctrica y estado de contactos activo.
* **Componentes Eléctricos (Norma IEC):**
  * Alimentación (24V / 0V).
  * Pulsadores NA (Normalmente Abierto) y NC (Normalmente Cerrado).
  * Bobinas de Relé e Indicadores de Estado.
  * Temporizadores al Trabajo (**TON**) con conteo dinámico descendente y visualización clara sobre la bobina.
  * Contactos Auxiliares NA / NC asociados a relés y temporizadores.
* **Componentes Neumáticos (Norma ISO):**
  * Válvulas distribuidoras 3/2 NC.
  * Cilindros neumáticos de simple y doble efecto.
* **Edición Dinámica:** Doble clic para reconfigurar el tiempo de retardo en temporizadores TON y parámetros de componentes sin reiniciar la aplicación.

---

## 🛠️ Tecnologías Utilizadas

* **JavaScript (ES6+):** Lógica del motor de simulación, resolución de circuitos y propagación de estados.
* **Konva.js:** Renderizado de gráficos en Canvas 2D, gestión de eventos y control de capas (Z-Index).
* **HTML5 / CSS3:** Interfaz de usuario oscura (Dark Mode) con panel lateral de herramientas y controles de simulación.
* **Node.js / Express:** Servidor web para entorno de desarrollo local y despliegue.

---

## 💻 Instalación y Uso Local

1. **Clonar el repositorio:**
   git clone https://github.com/sobermau/opensimu-web.git
   cd opensimu-web

2. **Instalar dependencias:**
   npm install

3. **Iniciar el servidor:**
   npm start

4. **Abrir en el navegador:**
   Navega a http://localhost:3000 para acceder a la aplicación.

---

## 🎯 Guía Rápida de Uso

1. **Agregar componentes:** Haz clic en cualquier elemento del panel izquierdo (*Eléctrica* o *Neumática*) para insertarlo en el lienzo.
2. **Cableado:** Haz clic sobre un terminal/pin de inicio y arrastra hacia el terminal de destino para establecer la conexión eléctrica.
3. **Configurar Temporizadores (TON):** 
   * Asigna un *tag* único (ej. `KT1`).
   * Haz **doble clic** sobre la bobina del temporizador fuera del modo de simulación para cambiar los segundos de retardo.
4. **Simulación:**
   * Presiona el botón **Iniciar Simulación**.
   * Interactúa con los pulsadores para energizar las bobinas y observar la temporización y conmutación de contactos en tiempo real.
