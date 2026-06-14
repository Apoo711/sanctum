let vaultTimer = null;
function accessResource(title, format, size, downloadUrl) {
    const vault = document.getElementById('decanting-vault');
    const logsContainer = document.getElementById('vault-logs');
    if (!vault || !logsContainer) return;

    // Clear previous timeouts and initialize state
    if (vaultTimer) clearTimeout(vaultTimer);
    logsContainer.innerHTML = '';
    
    // Display vault container
    vault.classList.remove('translate-y-24', 'opacity-0');
    vault.classList.add('translate-y-0', 'opacity-100');

    const logMessages = [
        { text: `[VAULT] Requesting connection...`, color: 'text-sanctum-accent/50' },
        { text: `[VAULT] decanting: "${title}"`, color: 'text-emerald-500' },
        { text: `[DECRYPT] decoding signature (${format} // ${size})`, color: 'text-sanctum-accent/70' },
        { text: `[VAULT] credentials verified.`, color: 'text-sanctum-accent/70' },
        { text: `[SUCCESS] decanted successfully.`, color: 'text-emerald-400 font-bold' }
    ];

    let i = 0;
    function printNextLog() {
        if (i < logMessages.length) {
            const line = document.createElement('div');
            line.className = `${logMessages[i].color} animate-[pulse_0.1s_ease-out]`;
            line.innerHTML = logMessages[i].text;
            logsContainer.appendChild(line);
            
            // Audio or haptic cues could be simulated here, or standard console logging
            i++;
            let delay = 600;
            if (i === 1) delay = 400;
            if (i === 2) delay = 800;
            if (i === 4) delay = 500;
            
            vaultTimer = setTimeout(printNextLog, delay);
        } else {
            // Trigger the redirect download to GitHub Releases
            window.location.href = downloadUrl;

            // Auto dismiss vault overlay after 4 seconds
            vaultTimer = setTimeout(() => {
                vault.classList.add('translate-y-24', 'opacity-0');
                vault.classList.remove('translate-y-0', 'opacity-100');
            }, 4000);
        }
    }

    printNextLog();
}
