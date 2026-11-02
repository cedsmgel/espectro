import React from 'react';
import { Link } from 'react-router-dom';
import { Header } from '../components/Header';
import { SidebarNav } from '../components/SidebarNav';
import { CONTROLLER, DPO, LEGAL_UPDATED, MIN_AGE } from '../lib/legal';

const Shell: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
  <div className="min-h-screen bg-surface text-on-surface flex flex-col">
    <Header />
    <SidebarNav />
    <div className="pt-16 md:pt-0 md:pl-20">
      <main className="w-full max-w-2xl mx-auto px-4 pt-6 pb-28 md:pb-12">
        <Link to="/menu" className="inline-flex items-center gap-1 text-xs font-semibold text-on-surface-variant hover:text-on-surface">
          <span className="material-symbols-outlined text-[16px]">arrow_back</span>
          Configurações e atividade
        </Link>
        <h1 className="text-2xl font-bold mt-2">{title}</h1>
        <p className="text-xs text-on-surface-variant mt-1 mb-6">Última atualização: {LEGAL_UPDATED}</p>
        <article className="flex flex-col gap-6 text-sm leading-relaxed text-on-surface [&_h2]:text-base [&_h2]:font-bold [&_h2]:mb-1.5 [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:flex [&_ul]:flex-col [&_ul]:gap-1 [&_a]:text-primary [&_a]:underline [&_th]:text-left [&_th]:pr-3 [&_th]:py-1 [&_td]:pr-3 [&_td]:py-1 [&_td]:align-top">
          {children}
        </article>
      </main>
    </div>
  </div>
);

// Referência normativa discreta, ao lado da regra
const Ref: React.FC<{ children: React.ReactNode }> = ({ children }) => <span className="text-xs text-on-surface-variant">({children})</span>;

export const TermsPage: React.FC = () => (
  <Shell title="Termos de Uso">
    <section>
      <h2>1. Objeto e aceitação</h2>
      <p>
        Estes Termos regulam o uso do Espectro, rede social que permite publicar conteúdo, criar Momentum, participar de comunidades e trocar mensagens
        privadas e em grupo. Ao criar uma conta ou utilizar o serviço, você declara ter lido e aceitado estes Termos e a{' '}
        <Link to="/privacidade">Política de Privacidade</Link>. Se não concordar, não utilize o serviço.
      </p>
    </section>

    <section>
      <h2>2. Elegibilidade</h2>
      <ul>
        <li>
          A idade mínima para criar conta é de <strong>{MIN_AGE} anos</strong>, declarada no cadastro. A declaração é registrada junto com a data do aceite.
        </li>
        <li>
          O Espectro poderá solicitar comprovação de idade e suspender ou excluir contas quando houver indícios de que o titular não atende à idade
          mínima ou às regras aplicáveis a crianças e adolescentes <Ref>Lei nº 15.211/2025 (ECA Digital)</Ref>.
        </li>
        <li>Pessoas com menos de 18 anos devem utilizar o serviço com o conhecimento de seus responsáveis legais.</li>
      </ul>
    </section>

    <section>
      <h2>3. Conta e segurança</h2>
      <ul>
        <li>Você é responsável pela veracidade dos dados informados, pela guarda de sua senha e por toda atividade realizada em sua conta.</li>
        <li>É vedado manter conta em nome de terceiro, criar identidade falsa ou transferir a conta.</li>
        <li>Recomenda-se ativar a verificação em duas etapas na Central de contas e comunicar imediatamente qualquer acesso não autorizado.</li>
        <li>Você pode encerrar a conta a qualquer tempo. A exclusão é efetivada após o prazo de arrependimento de 30 (trinta) dias, ressalvadas as hipóteses de guarda obrigatória previstas em lei <Ref>Lei nº 12.965/2014, art. 7º, X</Ref>.</li>
      </ul>
    </section>

    <section>
      <h2>4. Conteúdo do usuário</h2>
      <ul>
        <li>
          Você mantém a titularidade do conteúdo que publica e é o único responsável por ele. Para operar o serviço, concede ao Espectro licença não
          exclusiva, gratuita e limitada para armazenar, reproduzir, adaptar tecnicamente (por exemplo, redimensionar imagens) e exibir o conteúdo às
          pessoas que você escolher por meio das configurações de privacidade, pelo tempo em que o conteúdo permanecer na plataforma.
        </li>
        <li>Você declara possuir os direitos necessários sobre o que publica, inclusive de imagem e de terceiros nele retratados.</li>
        <li>
          Mensagens temporárias e mídias de visualização única são removidas ou ocultadas conforme o prazo escolhido, mas o Espectro não pode impedir
          captura de tela ou cópia do conteúdo por outros meios.
        </li>
        <li>Mensagens privadas são acessadas por nós somente nas hipóteses legais, como ordem judicial <Ref>Lei nº 12.965/2014, art. 10</Ref>, ou denúncia apresentada por participante da conversa.</li>
      </ul>
    </section>

    <section>
      <h2>5. Condutas vedadas</h2>
      <p>É proibido utilizar o Espectro para:</p>
      <ul>
        <li>praticar ou incitar crimes, ameaça, perseguição, assédio, discriminação ou discurso de ódio;</li>
        <li>divulgar conteúdo que envolva exploração ou abuso sexual de crianças e adolescentes, ou imagens íntimas sem consentimento;</li>
        <li>aplicar golpes, praticar fraude, spam ou falsidade ideológica, ou tentar acessar contas e dados de terceiros;</li>
        <li>violar direitos autorais, de marca ou outros direitos de propriedade intelectual;</li>
        <li>burlar limites técnicos, coletar dados em massa (<em>scraping</em>) ou interferir no funcionamento da plataforma.</li>
      </ul>
    </section>

    <section>
      <h2>6. Moderação, denúncias e medidas</h2>
      <ul>
        <li>Qualquer pessoa autenticada pode denunciar publicações, comentários, mensagens e perfis pelo menu do item. A denúncia identifica quem a fez; não há denúncia anônima.</li>
        <li>
          Conteúdo e contas que violem estes Termos poderão ser removidos, restringidos, suspensos ou encerrados, com ou sem aviso prévio quando a
          medida for urgente para proteger pessoas, o serviço ou cumprir a lei. As ações de moderação ficam registradas.
        </li>
        <li>
          Conteúdo que viole direitos de crianças e adolescentes será retirado tão logo comunicado, independentemente de ordem judicial{' '}
          <Ref>Lei nº 15.211/2025, art. 29</Ref>. Conteúdo íntimo divulgado sem autorização será indisponibilizado de forma diligente após notificação{' '}
          <Ref>Lei nº 12.965/2014, art. 21</Ref>.
        </li>
        <li>
          Cumpriremos ordens judiciais específicas de indisponibilização e observaremos o regime de responsabilidade dos provedores de aplicações
          fixado em lei e na jurisprudência vigente <Ref>Lei nº 12.965/2014, art. 19, e Tema 987 do STF</Ref>.
        </li>
      </ul>
    </section>

    <section>
      <h2>7. Propriedade intelectual e notificação de infração</h2>
      <p>
        A marca, o nome, o código e o design do Espectro pertencem a seus titulares e não são cedidos por estes Termos. Se você é titular de direito
        autoral e entende que uma obra foi publicada sem autorização <Ref>Lei nº 9.610/1998</Ref>, envie notificação pelo{' '}
        <Link to="/suporte/contato">formulário de suporte</Link> (assunto “Direitos autorais”) contendo: identificação da obra; link do conteúdo; seus dados
        de contato; declaração de boa-fé de que o uso não é autorizado; e declaração, sob as penas da lei, de que as informações são verdadeiras e de que você
        é o titular ou representante. O autor do conteúdo poderá apresentar contestação pelo mesmo canal.
      </p>
    </section>

    <section>
      <h2>8. Disponibilidade e limitação de responsabilidade</h2>
      <ul>
        <li>O Espectro está em fase de testes e é fornecido “no estado em que se encontra”, podendo sofrer alterações, interrupções ou perda de funcionalidades.</li>
        <li>Não nos responsabilizamos pelo conteúdo publicado por usuários, salvo nas hipóteses em que a lei assim determine.</li>
        <li>Nada nestes Termos exclui direitos do consumidor ou responsabilidades que a lei não permita limitar.</li>
      </ul>
    </section>

    <section>
      <h2>9. Alterações</h2>
      <p>Podemos alterar estes Termos. Mudanças relevantes serão comunicadas no serviço, e o uso continuado após a vigência indica concordância. A data da última atualização consta no topo da página.</p>
    </section>

    <section>
      <h2>10. Lei aplicável e contato</h2>
      <p>
        Aplica-se a legislação brasileira. Fica eleito o foro do domicílio do usuário para dirimir controvérsias, nos termos da lei. Dúvidas, solicitações e
        reclamações: <Link to="/suporte/contato">fale com o suporte</Link>.
      </p>
    </section>
  </Shell>
);

export const PrivacyPage: React.FC = () => (
  <Shell title="Política de Privacidade">
    <section>
      <h2>1. Quem somos e como falar conosco</h2>
      <p>
        Esta Política explica como o Espectro trata dados pessoais, em conformidade com a Lei Geral de Proteção de Dados Pessoais (LGPD, Lei nº 13.709/2018)
        e o Marco Civil da Internet (Lei nº 12.965/2014).
      </p>
      <ul className="mt-2">
        <li>
          <strong>Controlador:</strong>{' '}
          {CONTROLLER ? `${CONTROLLER.name}${CONTROLLER.document ? `, ${CONTROLLER.document}` : ''}${CONTROLLER.address ? `, ${CONTROLLER.address}` : ''}` : 'responsável pela operação do Espectro, que decide sobre o tratamento dos dados descritos nesta Política'}
          .
        </li>
        <li>
          <strong>Encarregado pelo tratamento de dados (DPO):</strong>{' '}
          {DPO ? `${DPO.name}, ${DPO.email}` : <>canal pelo <Link to="/suporte/contato">formulário de suporte</Link> (assunto “Meus dados”)</>}.
        </li>
      </ul>
    </section>

    <section>
      <h2>2. Dados que tratamos, finalidades e bases legais</h2>
      <div className="overflow-x-auto">
        <table className="w-full text-xs border-collapse">
          <thead>
            <tr className="border-b border-outline-variant">
              <th>Dados</th>
              <th>Finalidade</th>
              <th>Base legal (LGPD)</th>
            </tr>
          </thead>
          <tbody className="[&_tr]:border-b [&_tr]:border-outline-variant/60">
            <tr>
              <td>Nome de usuário, e-mail, senha (em formato irreversível), identificador da conta Google (se usada)</td>
              <td>Criar e manter a conta, autenticar e comunicar-se com você</td>
              <td>Execução de contrato, art. 7º, V</td>
            </tr>
            <tr>
              <td>Foto, capa, nome, biografia e informações de perfil opcionais</td>
              <td>Exibir seu perfil conforme a privacidade que você escolher</td>
              <td>Execução de contrato (art. 7º, V) e consentimento para campos opcionais (art. 7º, I)</td>
            </tr>
            <tr>
              <td>Publicações, comentários, votos, salvos, Momentum, mensagens privadas e de grupo, arquivos enviados</td>
              <td>Prestar o serviço de publicação e comunicação</td>
              <td>Execução de contrato, art. 7º, V</td>
            </tr>
            <tr>
              <td>Amizades, seguidores, bloqueios e participação em comunidades</td>
              <td>Funcionamento das relações e da privacidade</td>
              <td>Execução de contrato, art. 7º, V</td>
            </tr>
            <tr>
              <td>IP, localização aproximada (país, região, cidade), navegador, sistema e tipo de aparelho em cada login</td>
              <td>Segurança da conta (lista de aparelhos, aviso de acesso novo) e prevenção a abuso; guarda de registros de acesso</td>
              <td>Obrigação legal (art. 7º, II; Marco Civil, art. 15) e legítimo interesse em segurança (art. 7º, IX)</td>
            </tr>
            <tr>
              <td>Atividade de leitura (publicações exibidas e tempo de exibição)</td>
              <td>Ordenar o feed “Para você” e avaliar a qualidade da ordenação</td>
              <td>Legítimo interesse (art. 7º, IX), com opção de desligar</td>
            </tr>
            <tr>
              <td>Endereço de entrega de notificações push do aparelho</td>
              <td>Enviar notificações que você ativar</td>
              <td>Consentimento, art. 7º, I</td>
            </tr>
            <tr>
              <td>Denúncias, registros de moderação e mensagens ao suporte</td>
              <td>Moderar, atender pedidos e exercer direitos</td>
              <td>Legítimo interesse (art. 7º, IX), obrigação legal (art. 7º, II) e exercício regular de direitos (art. 7º, VI)</td>
            </tr>
            <tr>
              <td>Data da declaração de idade mínima e do aceite dos Termos</td>
              <td>Comprovar o aceite e a elegibilidade</td>
              <td>Exercício regular de direitos (art. 7º, VI) e execução de contrato (art. 7º, V)</td>
            </tr>
          </tbody>
        </table>
      </div>
      <p className="mt-2">Não tratamos dados pessoais sensíveis (art. 5º, II) de forma intencional. Se você optar por informá-los no perfil ou em conteúdo, o fará por sua conta e sob as configurações de privacidade escolhidas. Não vendemos dados pessoais e não os utilizamos para publicidade.</p>
    </section>

    <section>
      <h2>3. Compartilhamento e operadores</h2>
      <p>Dados são compartilhados somente na medida necessária com:</p>
      <ul>
        <li><strong>Cloudflare, Inc.</strong> (operador): hospedagem, banco de dados, armazenamento de arquivos, rede de entrega e proteção contra robôs (Turnstile).</li>
        <li><strong>Giphy, Inc.</strong>: busca de GIFs e figurinhas no chat (sua busca é enviada ao serviço).</li>
        <li><strong>Google LLC</strong>: apenas se você escolher entrar com a conta Google.</li>
        <li><strong>Autoridades públicas</strong>: mediante ordem judicial ou requisição legal <Ref>Lei nº 12.965/2014, arts. 10 e 15</Ref>.</li>
        <li>Outras pessoas usuárias, conforme a visibilidade que você escolher no perfil, nas publicações e nas conversas.</li>
      </ul>
    </section>

    <section>
      <h2>4. Transferência internacional</h2>
      <p>
        Os provedores acima operam, em parte, fora do Brasil. A transferência ocorre para viabilizar o serviço e, na medida exigida, com amparo em garantias
        contratuais oferecidas pelos operadores <Ref>LGPD, art. 33, II</Ref>. Você pode pedir informações pelo canal indicado no item 1.
      </p>
    </section>

    <section>
      <h2>5. Prazos de conservação</h2>
      <ul>
        <li><strong>Registros de acesso (IP e localização de sessões):</strong> até 6 (seis) meses <Ref>Marco Civil, art. 15</Ref>, sendo apagados em seguida.</li>
        <li><strong>Atividade de leitura:</strong> até 90 (noventa) dias; você pode apagar antes ou desligar a personalização.</li>
        <li><strong>Mensagens temporárias:</strong> eliminadas depois do prazo escolhido na conversa.</li>
        <li>
          <strong>Conta excluída:</strong> após o prazo de arrependimento de 30 dias, eliminamos conteúdo, relações e arquivos. As mensagens enviadas e
          recebidas deixam de existir também para a outra pessoa.
        </li>
        <li>
          <strong>Dados de moderação e de suporte:</strong> mantidos pelo tempo necessário ao cumprimento de obrigação legal e ao exercício regular de
          direitos <Ref>LGPD, arts. 7º, II e VI, e 16, I</Ref>.
        </li>
      </ul>
    </section>

    <section>
      <h2>6. Seus direitos como titular</h2>
      <p>Nos termos do art. 18 da LGPD, você pode, a qualquer momento e mediante requisição:</p>
      <ul>
        <li>confirmar a existência de tratamento e acessar seus dados;</li>
        <li>corrigir dados incompletos, inexatos ou desatualizados;</li>
        <li>solicitar anonimização, bloqueio ou eliminação de dados desnecessários, excessivos ou tratados em desconformidade;</li>
        <li>pedir a portabilidade e a eliminação dos dados tratados com base no consentimento;</li>
        <li>obter informação sobre as entidades com as quais compartilhamos dados e sobre a possibilidade de não consentir e suas consequências;</li>
        <li>revogar o consentimento (por exemplo, desativando as notificações push).</li>
      </ul>
      <p className="mt-2">
        <strong>Como exercer:</strong> baixar seus dados e excluir a conta na Central de contas; corrigir o perfil em Editar perfil; demais pedidos pelo{' '}
        <Link to="/suporte/contato">suporte</Link> (assunto “Meus dados”). Respondemos em até 15 (quinze) dias <Ref>LGPD, art. 19, II</Ref>. Você também pode
        peticionar à Autoridade Nacional de Proteção de Dados (ANPD) <Ref>LGPD, art. 18, § 1º</Ref>.
      </p>
    </section>

    <section>
      <h2>7. Crianças e adolescentes</h2>
      <p>
        O serviço exige idade mínima de {MIN_AGE} anos. O tratamento de dados de crianças e adolescentes observa o seu melhor interesse{' '}
        <Ref>LGPD, art. 14</Ref> e as regras de proteção da Lei nº 15.211/2025. Se tomarmos conhecimento de que uma conta pertence a pessoa abaixo da idade
        mínima, ela será suspensa ou excluída. Responsáveis legais podem solicitar informações ou a exclusão pelo <Link to="/suporte/contato">suporte</Link>.
      </p>
    </section>

    <section>
      <h2>8. Segurança e incidentes</h2>
      <p>
        Adotamos medidas técnicas e administrativas proporcionais, como conexão criptografada, senhas com proteção irreversível, limite de tentativas,
        verificação em duas etapas opcional, controle de acesso administrativo e sessões que você pode encerrar. Em caso de incidente que possa acarretar
        risco ou dano relevante, comunicaremos a ANPD e as pessoas afetadas <Ref>LGPD, art. 48</Ref>.
      </p>
    </section>

    <section>
      <h2>9. Cookies e armazenamento no aparelho</h2>
      <p>Utilizamos armazenamento local do navegador para manter sua sessão e suas preferências (tema, filtros do feed, mídia). Não utilizamos cookies de publicidade. Serviços de terceiros incorporados (como Cloudflare e Google) podem definir os próprios cookies, conforme as políticas deles.</p>
    </section>

    <section>
      <h2>10. Alterações desta Política</h2>
      <p>Podemos atualizar esta Política para refletir mudanças legais ou do serviço. Alterações relevantes serão comunicadas, e a data de atualização consta no topo da página.</p>
    </section>
  </Shell>
);
