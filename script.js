/* =========================================================
   script.js — Panel de gestión de usuarios
   Funciones: cargar usuarios desde una API, buscar en vivo,
   agregar (validando el id), modificar y eliminar.
   Los cambios solo existen mientras la página está abierta.
   ========================================================= */

// ---------- 1. Constantes y estado ----------

// Dirección de la API. (Para probar el manejo de errores, cambia la URL por una incorrecta)
const URL_API = "https://jsonplaceholder.typicode.com/users";

// Array de objetos con la forma { id, nombre, correo, ciudad }
let usuarios = [];

// Guarda el id del usuario que se está editando. null = estamos agregando
let idEnEdicion = null;

// ---------- 2. Referencias al DOM ----------

const formulario = document.getElementById("formulario");
const tituloFormulario = document.getElementById("titulo-formulario");
const campoId = document.getElementById("campo-id");
const campoNombre = document.getElementById("campo-nombre");
const campoCorreo = document.getElementById("campo-correo");
const campoCiudad = document.getElementById("campo-ciudad");
const botonEnviar = document.getElementById("btn-enviar");
const botonCancelar = document.getElementById("btn-cancelar");
const buscador = document.getElementById("buscador");
const cuerpoTabla = document.getElementById("cuerpo-tabla");
const mensaje = document.getElementById("mensaje");
const contador = document.getElementById("contador");
const listaCiudades = document.getElementById("lista-ciudades");

// ---------- 3. Funciones de apoyo ----------

// Muestra un mensaje de estado. tipo: "info", "ok" o "error" (cambia el color)
const mostrarMensaje = (texto, tipo = "info") => {
  mensaje.textContent = texto;
  mensaje.className = `mensaje ${tipo}`;
};

// Escapa caracteres especiales para insertar texto de forma segura con innerHTML
const escaparHTML = (texto) => {
  const reemplazos = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
  return String(texto).replace(/[&<>"']/g, (caracter) => reemplazos[caracter]);
};

// Cuenta cuántos usuarios hay por ciudad usando un bucle for...of
const contarPorCiudad = () => {
  const conteo = {};
  for (const { ciudad } of usuarios) {
    // Si la ciudad ya existe suma 1; si no, empieza en 1
    conteo[ciudad] = (conteo[ciudad] || 0) + 1;
  }
  return conteo;
};

// ---------- 4. Dibujar la interfaz ----------

// Dibuja la tabla. Usa filter() para la búsqueda SIN modificar el array original
const dibujarTabla = () => {
  const texto = buscador.value.trim().toLowerCase();

  // filter() crea un array nuevo con los usuarios cuyo nombre coincide
  const visibles = usuarios.filter(({ nombre }) => nombre.toLowerCase().includes(texto));

  contador.textContent = `Mostrando ${visibles.length} de ${usuarios.length} usuarios`;

  // Si no hay nada que mostrar, ponemos una fila con un aviso
  if (visibles.length === 0) {
    cuerpoTabla.innerHTML = `
      <tr class="fila-vacia">
        <td colspan="5">${texto ? "Ningún usuario coincide con la búsqueda." : "No hay usuarios para mostrar."}</td>
      </tr>`;
    return;
  }

  // Armamos las filas con template strings y destructuring
  let filas = "";
  visibles.forEach((usuario) => {
    const { id, nombre, correo, ciudad } = usuario;
    filas += `
      <tr>
        <td data-label="Id">${id}</td>
        <td data-label="Nombre">${escaparHTML(nombre)}</td>
        <td data-label="Correo">${escaparHTML(correo)}</td>
        <td data-label="Ciudad">${escaparHTML(ciudad)}</td>
        <td data-label="Acciones" class="celda-acciones">
          <div class="botones-fila">
            <button type="button" class="btn btn-secundario btn-chico" data-accion="editar" data-id="${id}"
              aria-label="Editar a ${escaparHTML(nombre)}">Editar</button>
            <button type="button" class="btn btn-peligro btn-chico" data-accion="eliminar" data-id="${id}"
              aria-label="Eliminar a ${escaparHTML(nombre)}">Eliminar</button>
          </div>
        </td>
      </tr>`;
  });
  cuerpoTabla.innerHTML = filas;
};

// Dibuja el resumen de usuarios por ciudad
const dibujarResumenCiudades = () => {
  const conteo = contarPorCiudad();
  const items = Object.entries(conteo).map(
    ([ciudad, cantidad]) => `<li>${escaparHTML(ciudad)}: ${cantidad}</li>`
  );
  listaCiudades.innerHTML = items.join("");
};

// Se llama CADA VEZ que cambia la lista: imprime el array y redibuja todo
const actualizarVista = () => {
  console.log(JSON.stringify(usuarios, null, 2));
  dibujarTabla();
  dibujarResumenCiudades();
};

// ---------- 5. Carga de datos (fetch + async/await) ----------

const cargarUsuarios = async () => {
  mostrarMensaje("Cargando usuarios...", "info");

  try {
    const res = await fetch(URL_API);

    // fetch no lanza error con respuestas 404/500, así que lo revisamos a mano
    if (!res.ok) {
      throw new Error(`La API respondió con el código ${res.status}`);
    }

    const datos = await res.json(); // convertimos la respuesta a JSON

    // map(): nos quedamos solo con los campos que necesita la tabla
    usuarios = datos.map(({ id, name, email, address }) => ({
      id,
      nombre: name,
      correo: email,
      ciudad: address?.city ?? "Sin ciudad",
    }));

    mostrarMensaje(`Se cargaron ${usuarios.length} usuarios correctamente.`, "ok");
  } catch (error) {
    console.error("Error al cargar los usuarios:", error);
    mostrarMensaje(
      "No pudimos cargar los usuarios. Revisa tu conexión a internet y recarga la página.",
      "error"
    );
  } finally {
    // Se ejecuta siempre: dibujamos la tabla con lo que haya
    actualizarVista();
  }
};

// ---------- 6. Validación del formulario ----------

// Revisa los datos y devuelve un objeto { codigo, ... } que describe el resultado
const validarDatos = ({ id, nombre, correo, ciudad }, editando) => {
  const datos = { id, nombre, correo, ciudad };

  // Al editar el id está bloqueado, así que no se revisa
  const camposObligatorios = editando
    ? ["nombre", "correo", "ciudad"]
    : ["id", "nombre", "correo", "ciudad"];

  // Bucle: recorre los campos y se detiene en el primero que esté vacío
  for (const campo of camposObligatorios) {
    if (datos[campo] === "") {
      return { codigo: "vacio", campo };
    }
  }

  if (!editando) {
    // El id debe ser un número entero positivo (solo dígitos)
    if (!/^\d+$/.test(id) || Number(id) < 1) {
      return { codigo: "id-invalido" };
    }

    // El id no puede existir ya (incluye los usuarios que llegaron de la API)
    const idNumero = Number(id);
    if (usuarios.some((usuario) => usuario.id === idNumero)) {
      return { codigo: "id-repetido", id: idNumero };
    }
  }

  if (!correo.includes("@")) {
    return { codigo: "correo-invalido" };
  }

  return { codigo: "ok" };
};

// Elige el mensaje de error según el resultado de la validación (switch)
const mostrarErrorValidacion = (resultado) => {
  switch (resultado.codigo) {
    case "vacio":
      mostrarMensaje(`El campo "${resultado.campo}" no puede estar vacío.`, "error");
      break;
    case "id-invalido":
      mostrarMensaje("El id debe ser un número entero mayor a 0 (solo dígitos).", "error");
      break;
    case "id-repetido":
      mostrarMensaje(`Ya existe un usuario con el id ${resultado.id}.`, "error");
      break;
    case "correo-invalido":
      mostrarMensaje('El correo no es válido: debe contener un "@".', "error");
      break;
    default:
      mostrarMensaje("Revisa los datos del formulario.", "error");
  }
};

// ---------- 7. Modo agregar / modo editar ----------

// Vuelve el formulario al estado inicial (modo agregar)
const reiniciarFormulario = () => {
  formulario.reset();
  idEnEdicion = null;
  campoId.disabled = false;
  botonEnviar.textContent = "Agregar";
  botonCancelar.hidden = true;
  tituloFormulario.textContent = "Nuevo usuario";
};

// Carga los datos de un usuario en el formulario para modificarlo
const iniciarEdicion = (id) => {
  const usuario = usuarios.find((u) => u.id === id);
  if (!usuario) return;

  const { nombre, correo, ciudad } = usuario;

  campoId.value = id;
  campoNombre.value = nombre;
  campoCorreo.value = correo;
  campoCiudad.value = ciudad;

  idEnEdicion = id;
  campoId.disabled = true; // el id queda bloqueado
  botonEnviar.textContent = "Guardar cambios";
  botonCancelar.hidden = false;
  tituloFormulario.textContent = "Editar usuario";

  mostrarMensaje(`Editando al usuario "${nombre}". Cambia los datos y guarda.`, "info");
  formulario.scrollIntoView({ behavior: "smooth", block: "start" });
  campoNombre.focus();
};

// Elimina un usuario después de pedir confirmación
const eliminarUsuario = (id) => {
  const usuario = usuarios.find((u) => u.id === id);
  if (!usuario) return;

  const { nombre } = usuario;

  if (!confirm(`¿Seguro que quieres eliminar a "${nombre}"?`)) {
    mostrarMensaje("Eliminación cancelada.", "info");
    return;
  }

  // filter(): crea un array nuevo sin el usuario eliminado
  usuarios = usuarios.filter((u) => u.id !== id);

  // Si justo se estaba editando ese usuario, se cancela la edición
  if (idEnEdicion === id) {
    reiniciarFormulario();
  }

  mostrarMensaje(`Usuario "${nombre}" eliminado correctamente.`, "ok");
  actualizarVista();
};

// ---------- 8. Eventos ----------

// Envío del formulario: agrega o guarda cambios según el modo
formulario.addEventListener("submit", (event) => {
  event.preventDefault(); // evita que la página se recargue

  const datos = {
    id: campoId.value.trim(),
    nombre: campoNombre.value.trim(),
    correo: campoCorreo.value.trim(),
    ciudad: campoCiudad.value.trim(),
  };
  const { id, nombre, correo, ciudad } = datos;

  const editando = idEnEdicion !== null;
  const resultado = validarDatos(datos, editando);

  if (resultado.codigo !== "ok") {
    mostrarErrorValidacion(resultado);
    return; // no se agrega ni se modifica nada
  }

  if (editando) {
    // Modificar: buscamos el objeto por su id y actualizamos sus datos
    const usuario = usuarios.find((u) => u.id === idEnEdicion);
    Object.assign(usuario, { nombre, correo, ciudad });
    mostrarMensaje(`Usuario "${nombre}" actualizado correctamente.`, "ok");
  } else {
    // Agregar: el id llega como texto, lo guardamos como número
    usuarios.push({ id: Number(id), nombre, correo, ciudad });
    mostrarMensaje(`Usuario "${nombre}" agregado con el id ${id}.`, "ok");
  }

  buscador.value = ""; // limpiamos el filtro para que se vea el cambio
  reiniciarFormulario(); // limpia el formulario y el botón vuelve a "Agregar"
  actualizarVista();
});

// Búsqueda en vivo: cada vez que se escribe, se vuelve a filtrar la tabla
buscador.addEventListener("input", dibujarTabla);

// Delegación de eventos: un solo listener en el tbody atiende todos los botones
cuerpoTabla.addEventListener("click", (event) => {
  const boton = event.target.closest("button[data-accion]");
  if (!boton) return;

  const id = Number(boton.dataset.id);

  if (boton.dataset.accion === "editar") {
    iniciarEdicion(id);
  } else if (boton.dataset.accion === "eliminar") {
    eliminarUsuario(id);
  }
});

// Botón Cancelar: sale del modo edición sin guardar
botonCancelar.addEventListener("click", () => {
  reiniciarFormulario();
  mostrarMensaje("Edición cancelada.", "info");
});

// ---------- 9. Inicio ----------

cargarUsuarios();