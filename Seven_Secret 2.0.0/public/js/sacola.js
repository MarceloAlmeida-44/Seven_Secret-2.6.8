// Converte valores numéricos (499.99) e textos brasileiros ("R$ 499,99").
function dinheiroParaNumero(valor) {
    if (typeof valor === 'number') return Number.isFinite(valor) ? valor : 0;
    let texto = String(valor ?? '').replace(/R\$/gi, '').replace(/\s/g, '').trim();
    if (texto.includes(',')) texto = texto.replace(/\./g, '').replace(',', '.');
    const numero = Number(texto);
    return Number.isFinite(numero) ? numero : 0;
}

function formatarPreco(valor) {
    return dinheiroParaNumero(valor).toLocaleString('pt-BR', {
        style: 'currency', currency: 'BRL'
    });
}

// Puxar produtos
const carrinho = JSON.parse(localStorage.getItem('carrinho')) || [];

let listaProdutosHTM = document.querySelector('.listaProdutos');
let listaProduto = [];

// Função auxiliar para renderizar feedback visual universal (Ícone + Prefixo + Texto)
function renderizarAvisoInline(container, mensagem, tipo = 'erro') {
    if (!container) return;
    const isErro = tipo === 'erro';
    const icone = isErro ? 'alert-triangle' : 'check-circle-2';
    const prefixo = isErro ? '✕ Erro:' : '✓ Sucesso:';
    const classe = isErro ? 'feedback-erro-inline' : 'feedback-sucesso-inline';

    container.style.display = 'flex';
    container.className = `feedback-inline ${classe}`;
    container.innerHTML = `
        <i data-lucide="${icone}" aria-hidden="true"></i>
        <span><strong>${prefixo}</strong> ${mensagem}</span>
    `;
    if (window.lucide) lucide.createIcons();
}

const addDataToHTM = () => {
    if (!listaProdutosHTM) return;
    listaProdutosHTM.innerHTML = '';

    if (listaProduto.length > 0) {
        listaProduto.forEach(produto => {
            let newProdut = document.createElement('section');
            newProdut.classList.add('produto');

            newProdut.innerHTML = ` 
                <div class="cart-items">
                    <div class="cart-item" data-nome="${produto.nome}">
                        <div
                            class="item-img"
                            style="background-image: url('${produto.imagem}');"
                            role="img"
                            aria-label="Imagem do produto ${produto.nome}"
                        ></div>

                        <div class="item-info">
                            <p>${produto.nome}</p>
                            <h3>${produto.capacidade}</h3>

                            <div
                                class="item-qty"
                                role="group"
                                aria-label="Quantidade de ${produto.nome}"
                            >
                                <button
                                    type="button"
                                    class="qty-btn btn-menos"
                                    aria-label="Diminuir quantidade de ${produto.nome}"
                                >-</button>

                                <span
                                    class="qtd-atual"
                                    tabindex="0"
                                    role="status"
                                    aria-live="polite"
                                    aria-atomic="true"
                                    aria-label="Quantidade de ${produto.nome}: ${produto.quantidade || 1} unidades"
                                >${produto.quantidade || 1}</span>

                                <button
                                    type="button"
                                    class="qty-btn btn-mais"
                                    aria-label="Aumentar quantidade de ${produto.nome}"
                                >+</button>
                            </div>
                        </div>

                        <div style="text-align: right;">
                            <span class="item-price">
                                ${formatarPreco(produto.desconto ?? produto.preco)}
                            </span>

                            <button
                                type="button"
                                class="remove-btn"
                                aria-label="Remover ${produto.nome} da sacola"
                            >
                                <i data-lucide="trash-2" aria-hidden="true"></i> Remover
                            </button>
                        </div>
                    </div>
                </div>
            `;

            listaProdutosHTM.appendChild(newProdut);
        });
        if (window.lucide) lucide.createIcons();
    } else {
        listaProdutosHTM.innerHTML = `
            <div class="carrinho-vazio-box">
                <i data-lucide="shopping-bag" aria-hidden="true" style="width: 48px; height: 48px;"></i>
                <h2>Sua sacola está vazia</h2>
                <p>Navegue pelo nosso catálogo e adicione seus produtos favoritos.</p>
            </div>
        `;
        if (window.lucide) lucide.createIcons();
    }
};

const init = () => {
    listaProduto = JSON.parse(localStorage.getItem('carrinho')) || [];
    addDataToHTM();
    configurarEventosProdutos();
    atualizarCarrinho();
};

// VARIÁVEIS DE ESTADO
let valorFrete = 0;
let cupomAtivo = false; 
const percentualDesconto = 0.10; 

// MAPEAMENTO DOS ELEMENTOS DO RESUMO
const elSubtotal = document.getElementById('valor-subtotal');
const elFrete = document.getElementById('valor-frete');
const elDesconto = document.getElementById('valor-desconto');
const elTotal = document.getElementById('valor-total');
const elLinhaDesconto = document.getElementById('linha-desconto');

// FUNÇÃO QUE ATUALIZA OS PREÇOS E TOTAIS
function atualizarCarrinho() {
    let subtotal = 0;
    let temProdutosNaSacola = false;

    const produtosSacola = JSON.parse(localStorage.getItem('carrinho') || '[]');
    for (const produto of produtosSacola) {
        const qtd = Math.max(1, Number(produto.quantidade) || 1);
        const precoUnitario = dinheiroParaNumero(produto.desconto ?? produto.preco);
        subtotal += precoUnitario * qtd;
        temProdutosNaSacola = true;
    }

    if (!temProdutosNaSacola) {
        valorFrete = 0;
        cupomAtivo = false;
    }

    let valorDesconto = cupomAtivo ? (subtotal * percentualDesconto) : 0;
    let totalGeral = subtotal + valorFrete - valorDesconto;

    if (elSubtotal) elSubtotal.innerText = formatarPreco(subtotal);

    if (elFrete) {
        elFrete.innerText = valorFrete > 0 ? formatarPreco(valorFrete) : "R$ 0,00";
    }

    if (elLinhaDesconto && elDesconto) {
        if (valorDesconto > 0) {
            elLinhaDesconto.style.display = 'flex';
            elDesconto.innerText = "- " + formatarPreco(valorDesconto);
        } else {
            elLinhaDesconto.style.display = 'none';
        }
    }

    if (elTotal) elTotal.innerText = formatarPreco(totalGeral);
    localStorage.setItem('total_sacola', totalGeral.toFixed(2));
}

// CONTROLADORES DOS BOTÕES DE QUANTIDADE 
function configurarEventosProdutos() {
    document.querySelectorAll('.cart-item').forEach(item => {
        const btnMenos = item.querySelector('.btn-menos');
        const btnMais = item.querySelector('.btn-mais');
        const btnRemover = item.querySelector('.remove-btn');
        const elQtd = item.querySelector('.qtd-atual');

        const nomeProduto = item.dataset.nome;

        if (btnMenos && elQtd) {
            btnMenos.onclick = function () {
                let qtd = parseInt(elQtd.innerText);
                if (qtd > 1) {
                    qtd--;
                    elQtd.innerText = qtd;
                    atualizarQuantidadeStorage(nomeProduto, qtd);
                    atualizarCarrinho();
                }
            };
        }

        if (btnMais && elQtd) {
            btnMais.onclick = function () {
                let qtd = parseInt(elQtd.innerText);
                qtd++;
                elQtd.innerText = qtd;
                atualizarQuantidadeStorage(nomeProduto, qtd);
                atualizarCarrinho();
            };
        }

        if (btnRemover) {
            btnRemover.addEventListener('click', function () {
                let carrinho = JSON.parse(localStorage.getItem('carrinho')) || [];
                carrinho = carrinho.filter(prod => prod.nome !== nomeProduto);
                localStorage.setItem('carrinho', JSON.stringify(carrinho));
                item.remove();
                atualizarCarrinho();

                if (carrinho.length === 0) {
                    listaProdutosHTM.innerHTML = `
                        <div class="carrinho-vazio-box">
                            <i data-lucide="shopping-bag" aria-hidden="true" style="width: 48px; height: 48px;"></i>
                            <h2>Sua sacola está vazia</h2>
                            <p>Navegue pelo nosso catálogo e adicione seus produtos favoritos.</p>
                        </div>
                    `;
                    if (window.lucide) lucide.createIcons();
                }
            });
        }
    });
}

// Salvar quantidade
function atualizarQuantidadeStorage(nomeProduto, quantidade) {
    let carrinho = JSON.parse(localStorage.getItem('carrinho')) || [];
    carrinho = carrinho.map(produto => {
        if (produto.nome === nomeProduto) {
            produto.quantidade = quantidade;
        }
        return produto;
    });
    localStorage.setItem('carrinho', JSON.stringify(carrinho));
}

// SISTEMA DO CAMPO DE CUPOM ACESSÍVEL
const inputCupom = document.getElementById('input-cupom');
const btnCupom = document.getElementById('btn-cupom');
const txtCupom = document.getElementById('cupom-texto');

if (inputCupom && btnCupom && txtCupom) {
    inputCupom.value = "";              
    inputCupom.disabled = false;        
    btnCupom.innerText = "Confirmar";   
    btnCupom.className = "btn-inline confirm-btn";
    txtCupom.style.display = "none";    
    txtCupom.innerHTML = "";            

    btnCupom.onclick = function() {
        if (cupomAtivo) {
            cupomAtivo = false;
            localStorage.removeItem('cupom_seven_secrets');
            inputCupom.value = "";
            inputCupom.disabled = false;
            btnCupom.innerText = "Confirmar";
            btnCupom.className = "btn-inline confirm-btn";
            txtCupom.style.display = "none";
            txtCupom.innerHTML = "";
        } else {
            const cupomTexto = inputCupom.value.trim().toUpperCase();
            
            if (cupomTexto === "KWL28J" || cupomTexto === "SECRETS10") {
                cupomAtivo = true;
                localStorage.setItem('cupom_seven_secrets', cupomTexto);
                inputCupom.disabled = true;
                btnCupom.innerText = "Remover";
                btnCupom.className = "btn-inline applied-btn";
                renderizarAvisoInline(txtCupom, '10% de desconto aplicado com sucesso.', 'sucesso');
            } else {
                renderizarAvisoInline(txtCupom, 'Cupom inválido! Utilize SECRETS10 ou KWL28J.', 'erro');
                inputCupom.value = "";
            }
        }
        atualizarCarrinho(); 
    };
}

// SISTEMA DO CAMPO DE CEP ACESSÍVEL
const inputCep = document.getElementById('input-cep');
const btnCep = document.getElementById('btn-cep');
const txtEndereco = document.getElementById('endereco-texto');

if (inputCep) {
    inputCep.addEventListener('input', (e) => {
        let value = e.target.value.replace(/\D/g, '').slice(0, 8);
        if (value.length > 5) value = value.replace(/^(\d{5})(\d)/, '$1-$2');
        e.target.value = value;

        localStorage.removeItem('endereco_transicao_sacola');
        localStorage.removeItem('cep_transicao_sacola');
        if (txtEndereco) txtEndereco.style.display = 'none';
        valorFrete = 0;
        atualizarCarrinho();
    });
}

if (btnCep && inputCep && txtEndereco) {
    btnCep.onclick = async function () {
        const cep = inputCep.value.replace(/\D/g, '');

        if (cep.length !== 8) {
            renderizarAvisoInline(txtEndereco, 'Informe um CEP válido contendo 8 números.', 'erro');
            valorFrete = 0;
            atualizarCarrinho();
            return;
        }

        btnCep.innerText = 'Calculando...';
        btnCep.disabled = true;

        try {
            const dados = await buscarCEP(cep);
            const uf = dados.uf;
            let prazo = '';

            if (uf === 'SP') {
                valorFrete = 22.50;
                prazo = 'Sedex Disponível';
            } else if (['RJ', 'ES'].includes(uf)) {
                valorFrete = 31.90;
                prazo = '3 a 5 dias úteis';
            } else if (uf === 'MG') {
                valorFrete = 28.00;
                prazo = '2 a 4 dias úteis';
            } else if (['PR', 'SC', 'RS'].includes(uf)) {
                valorFrete = 35.00;
                prazo = '4 a 7 dias úteis';
            } else if (['DF', 'GO', 'MT', 'MS'].includes(uf)) {
                valorFrete = 38.50;
                prazo = '5 a 8 dias úteis';
            } else {
                valorFrete = 49.90;
                prazo = '7 a 12 dias úteis';
            }

            const endereco = {
                cep: dados.cep,
                rua: dados.logradouro,
                numero: '',
                complemento: dados.complemento,
                bairro: dados.bairro,
                cidade: dados.cidade,
                estado: dados.uf
            };

            localStorage.setItem('endereco_transicao_sacola', JSON.stringify(endereco));
            localStorage.setItem('cep_transicao_sacola', dados.cep);

            const enderecoLinha = [dados.logradouro, dados.bairro].filter(Boolean).join(', ');
            txtEndereco.textContent = '';
            
            const infoDiv = document.createElement('div');
            infoDiv.style.lineHeight = '1.5';
            infoDiv.innerHTML = `
                <p><strong><i data-lucide="map-pin" aria-hidden="true"></i> Endereço:</strong> ${enderecoLinha || 'Endereço não informado'} - ${dados.cidade}/${dados.uf}</p>
                <p style="color: #15803d; font-weight: 600; margin-top: 4px;">
                    <i data-lucide="check-circle-2" aria-hidden="true"></i> <strong>✓ Frete:</strong> ${formatarPreco(valorFrete)} (${prazo})
                </p>
            `;
            txtEndereco.appendChild(infoDiv);
            txtEndereco.style.display = 'block';
            if (window.lucide) lucide.createIcons();

            atualizarCarrinho();
        } catch (erro) {
            renderizarAvisoInline(txtEndereco, erro.message || 'Não foi possível consultar o CEP. Tente novamente.', 'erro');
            console.error('Erro na consulta do CEP:', erro);
            valorFrete = 0;
            localStorage.removeItem('endereco_transicao_sacola');
            localStorage.removeItem('cep_transicao_sacola');
            atualizarCarrinho();
        } finally {
            btnCep.innerText = 'Confirmar';
            btnCep.disabled = false;
        }
    };
}

const btnFinalizarCompra = document.getElementById('link-checkout') || document.querySelector('.btn-checkout');
if (btnFinalizarCompra && inputCep) {
    btnFinalizarCompra.addEventListener('click', () => {
        const cep = inputCep.value.replace(/\D/g, '');
        if (cep.length === 8) {
            localStorage.setItem('cep_transicao_sacola', cep);
        }
    });
}

document.addEventListener('DOMContentLoaded', () => {
    init();
    atualizarCarrinho();
});
