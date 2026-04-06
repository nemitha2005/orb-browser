import './styles/tailwind.css';

const input = document.getElementById('input') as HTMLInputElement;

function submitInput(): void {
  const value = input.value.trim();
  if (!value) {
    return;
  }

  void window.orb.floatNavigate(value);
  input.value = '';
}

input.addEventListener('keydown', event => {
  if (event.key === 'Enter') {
    submitInput();
    return;
  }

  if (event.key === 'Escape') {
    void window.orb.toggleFloat();
    input.value = '';
  }
});

window.addEventListener('focus', () => {
  input.focus();
  input.select();
});
