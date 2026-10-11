import './style.css';

const dog = document.querySelector('.dog-button');
const hint = document.querySelector('#hint-text');
const touchDevice = window.matchMedia('(hover: none)');

function updateHint() {
  hint.textContent = dog.classList.contains('is-loved')
    ? 'Вот так! Ты мне нравишься'
    : touchDevice.matches ? 'Коснись меня — давай дружить' : 'Наведи на меня курсор';
}

dog.addEventListener('click', () => {
  const loved = dog.classList.toggle('is-loved');
  dog.setAttribute('aria-pressed', String(loved));
  updateHint();
});
dog.addEventListener('pointerenter', (event) => {
  if (event.pointerType !== 'touch') hint.textContent = 'Вот так! Ты мне нравишься';
});
dog.addEventListener('pointerleave', updateHint);
dog.addEventListener('focus', () => { hint.textContent = 'Нажми Enter, чтобы погладить'; });
dog.addEventListener('blur', updateHint);
touchDevice.addEventListener('change', updateHint);
updateHint();
