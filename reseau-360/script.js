(() => {
  const form = document.querySelector('#commission-simulator');
  const amount = document.querySelector('#deal-amount');
  const amountOutput = document.querySelector('#amount-output');
  const rateOutput = document.querySelector('#rate-output');
  const commissionOutput = document.querySelector('#commission-output');
  if (!form || !amount || !amountOutput || !rateOutput || !commissionOutput) return;

  const euro = new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency: 'EUR',
    maximumFractionDigits: 0
  });

  function syncSimulator() {
    const dealAmount = Number(amount.value);
    const selectedRate = form.querySelector('input[name="rate"]:checked');
    const rate = selectedRate ? Number(selectedRate.value) : 10;
    amountOutput.textContent = euro.format(dealAmount);
    rateOutput.textContent = rate + ' %';
    commissionOutput.textContent = euro.format(dealAmount * rate / 100);
  }

  form.addEventListener('input', syncSimulator);
  form.addEventListener('change', syncSimulator);
  syncSimulator();

  window.addEventListener('pageshow', () => {
    requestAnimationFrame(syncSimulator);
    setTimeout(syncSimulator, 120);
  });
})();
