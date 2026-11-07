async function buscarCEP(cep) {
    const cepLimpo = String(cep ?? '').replace(/\D/g, '');

    if (cepLimpo.length !== 8) {
        throw new Error('Digite um CEP válido com 8 algarismos.');
    }

    const resposta = await fetch(`https://viacep.com.br/ws/${cepLimpo}/json/`);

    if (!resposta.ok) {
        throw new Error('Não foi possível consultar o CEP. Tente novamente.');
    }

    const dados = await resposta.json();

    if (dados.erro) {
        throw new Error('CEP não encontrado. Verifique os números e tente novamente.');
    }

    return {
        cep: dados.cep || cepLimpo,
        logradouro: dados.logradouro || '',
        complemento: dados.complemento || '',
        bairro: dados.bairro || '',
        cidade: dados.localidade || '',
        uf: dados.uf || '',
        estado: dados.estado || '',
        regiao: dados.regiao || '',
        ddd: dados.ddd || ''
    };
}

// Permite o uso por sacola.js e finalizarCompra.js.
window.buscarCEP = buscarCEP;
