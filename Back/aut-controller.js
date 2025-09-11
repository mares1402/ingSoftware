
import bcrypt from 'bcryptjs';

//Generar una sal para el hash
//(sal): Es un valor aleatorio que se añade a la contraseña antes de encriptarla.
//El número 10 indica el nivel de complejidad (cost factor)
const salt = bcrypt.genSaltSync(10);

//Crear el hash de la contraseña "B4c0/\"
//(hash): Es la representación encriptada de la contraseña original.
const hash = bcrypt.hashSync("B4c0/\\/", salt);


//Compara la contraseña "B4c0/\/" con el hash previamente generado.
//Devuelve true si coinciden, lo que significa que el usuario ingresó la contraseña correcta.

bcrypt.compareSync("B4c0/\\/", hash); // true


//Compara una contraseña incorrecta ("not_bacon") con el mismo hash.
//Devuelve false, indicando que la contraseña no es válida.

bcrypt.compareSync("not_bacon", hash); // false