document.querySelectorAll('.campo input, .campo select').forEach(elemento => {
    const label = elemento.parentElement.querySelector('label');

    const actualizarLabel = () => {
        if (elemento.value.trim() !== '') {
            label.classList.add('label-oculto');
        } else {
            label.classList.remove('label-oculto');
        }
    };

    actualizarLabel();
    elemento.addEventListener('input', actualizarLabel);
    elemento.addEventListener('change', actualizarLabel);
});

const encryptado = require('bcryptjs');
const conexion = require('../Back/conexion');

encryptado.encrypt()