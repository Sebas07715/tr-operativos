# Módulo 2 · Operativos de esterilización y chipeo

Backend y frontend web del Módulo 2 para la gestión de operativos de esterilización y chipeo, inscripciones, cancelaciones, registro de inasistencias, bloqueos y procedimientos clínicos.

# Estructura del proyecto

- src/: servidor Express, rutas, modelos de Mongoose, servicios y middlewares.
- public/: interfaz web ('index.html', 'estilos.css' y 'app.js').
- tests/: pruebas automatizadas ('reglas.test.js').
- 'scripts/': scripts de soporte ('seed.js' para carga inicial y 'probar.js' para verificación contra el servidor).
- 'package.json': dependencias y comandos npm del proyecto.

# Instalación y ejecución local
1. Clonar el reposiotrio:

git clone https://github.com/Sebas07715/tr-operativos.git

2. Para instalar dependencias utilizar el siguiente comando dentro de la terminal de:

- Verificar si esta dentro de tr-operativos:

\Users\usuario\Downloads\nucleo-tr-local\tr-operativos>

- Si no utilizar:

cd (nombre de la carpeta clonada)

- Cuando se vea dentro de la terminal que se esta dentro de la carpeta operativos, utilizar el comando de:

npm install

