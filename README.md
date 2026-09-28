# Click Celulares

Site da **Click Celulares**, assistência técnica de celulares em Carazinho/RS.

No topo, uma animação de rolagem desmonta um iPhone até os parafusos, em quatro passos
(abertura, parafusos, diagnóstico e tela). Os botões de orçamento abrem o WhatsApp da loja
com uma mensagem pronta.

## Como rodar

É um site estático (HTML, CSS e JavaScript, sem dependências). Abra com o Live Server do
VS Code ou qualquer servidor local e acesse `index.html`.

## Estrutura

| Arquivo | O que faz |
| --- | --- |
| `index.html` | Conteúdo do site |
| `css/style.css` | Estilos, cores da marca (`#004AAD`) e animações |
| `js/teardown.js` | Peças da desmontagem: recortes da foto e peças internas em SVG |
| `js/main.js` | Animação da rolagem, letras chegando, contadores e menu |
| `assets/` | Logo e foto do iPhone usada na animação |

## Ajustes rápidos

- **WhatsApp:** os links usam `https://wa.me/555433316011` em `index.html`.
- **Ordem e direção das peças:** tabela `MOTION` em `js/teardown.js`.
- **Textos dos passos:** blocos `.xray__step` em `index.html` (`data-from`/`data-to` definem quando aparecem).
