import React from 'react';
import { Link } from 'react-router-dom';
import { Header } from '../components/Header';
import { SidebarNav } from '../components/SidebarNav';

const UPDATED = '1 de novembro de 2026';

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
        <p className="text-xs text-on-surface-variant mt-1 mb-6">Atualizado em {UPDATED}</p>
        <article className="flex flex-col gap-6 text-sm leading-relaxed text-on-surface [&_h2]:text-base [&_h2]:font-bold [&_h2]:mb-1.5 [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:flex [&_ul]:flex-col [&_ul]:gap-1 [&_a]:text-primary [&_a]:underline">
          {children}
        </article>
      </main>
    </div>
  </div>
);

export const TermsPage: React.FC = () => (
  <Shell title="Termos de uso">
    <section>
      <h2>1. Sobre o Espectro</h2>
      <p>O Espectro é uma rede social para compartilhar publicações, Momentum e vídeos, participar de comunidades e conversar em mensagens privadas e grupos. Ao criar uma conta ou usar o serviço, você concorda com estes termos e com a <Link to="/privacidade">Política de Privacidade</Link>.</p>
    </section>
    <section>
      <h2>2. Sua conta</h2>
      <ul>
        <li>Você é responsável pelas informações que cadastra e por manter sua senha em segurança. Ative a verificação em duas etapas na Central de contas.</li>
        <li><strong>Idade mínima: 13 anos.</strong> Ao criar a conta você declara ter 13 anos ou mais. Se você tem menos de 18, use o Espectro com o conhecimento de quem é responsável por você. Contas de pessoas abaixo da idade mínima serão excluídas.</li>
        <li>Cada pessoa deve ter uma conta própria e verdadeira. Contas falsas, que se passam por outra pessoa ou criadas para fraudar o serviço podem ser removidas.</li>
        <li>Você pode excluir sua conta a qualquer momento. Há 30 dias para desistir; depois disso a exclusão é definitiva.</li>
      </ul>
    </section>
    <section>
      <h2>3. O que você publica</h2>
      <ul>
        <li>O conteúdo que você publica continua sendo seu. Você nos autoriza a armazená-lo, exibi-lo e entregá-lo às pessoas que você escolher (de acordo com suas configurações de privacidade) para que o serviço funcione.</li>
        <li>Publique apenas o que você tem direito de publicar. Não envie obras de terceiros sem autorização.</li>
        <li>Mensagens temporárias e mídias de visualização única somem conforme o prazo escolhido, mas não impedem que alguém capture a tela ou guarde o conteúdo por outros meios.</li>
      </ul>
    </section>
    <section>
      <h2>4. Condutas proibidas</h2>
      <ul>
        <li>Assédio, ameaças, discurso de ódio, perseguição ou exposição de dados de outras pessoas.</li>
        <li>Conteúdo ilegal, golpes, spam, falsidade ideológica e tentativa de acessar contas alheias.</li>
        <li>Conteúdo sexual envolvendo menores, violência explícita ou que incentive automutilação.</li>
        <li>Burlar limites do serviço, coletar dados em massa ou interferir no funcionamento da plataforma.</li>
      </ul>
    </section>
    <section>
      <h2>5. Moderação</h2>
      <p>Você pode denunciar publicações, mensagens, comentários e perfis pelo menu de cada item. A equipe analisa as denúncias e pode remover conteúdo, suspender ou encerrar contas que violem estes termos. As ações de moderação ficam registradas.</p>
    </section>
    <section>
      <h2>6. Direitos autorais</h2>
      <p>Se você é titular de uma obra e acredita que ela foi publicada sem autorização, envie um aviso pela página de <Link to="/suporte/contato">contato</Link> escolhendo o tema “Direitos autorais”, com a identificação da obra, o link do conteúdo, seus dados de contato e uma declaração de que o aviso é verdadeiro e de que você é o titular ou o representante. Quem teve conteúdo removido pode contestar pelo mesmo canal.</p>
    </section>
    <section>
      <h2>7. Disponibilidade e mudanças</h2>
      <p>O Espectro está em fase de testes e pode mudar, ficar indisponível ou perder funcionalidades. Faremos o possível para avisar mudanças importantes. Podemos atualizar estes termos; a data de atualização fica no topo desta página.</p>
    </section>
    <section>
      <h2>8. Contato</h2>
      <p>Dúvidas sobre estes termos: <Link to="/suporte/contato">fale com o suporte</Link>.</p>
    </section>
  </Shell>
);

export const PrivacyPage: React.FC = () => (
  <Shell title="Política de Privacidade">
    <section>
      <h2>1. Quais dados tratamos</h2>
      <ul>
        <li><strong>Conta:</strong> nome de usuário, e-mail, senha (guardada de forma irreversível) e, se você entrar com o Google, o identificador da sua conta Google.</li>
        <li><strong>Perfil:</strong> foto, capa, nome, biografia e as informações que você escolher preencher, cada uma com sua própria privacidade (público, amigos ou só você).</li>
        <li><strong>Conteúdo:</strong> publicações, comentários, votos, salvos, Momentum, mensagens privadas e de grupo e os arquivos enviados.</li>
        <li><strong>Relações:</strong> amizades, quem você segue, bloqueios e participação em comunidades.</li>
        <li><strong>Segurança:</strong> a cada login guardamos IP, localização aproximada (país, região, cidade), navegador, sistema e tipo de aparelho.</li>
        <li><strong>Atividade de leitura:</strong> quais publicações ficaram na tela e por quanto tempo, para ordenar o seu feed.</li>
        <li><strong>Notificações push:</strong> o endereço de entrega do seu aparelho, se você ativar.</li>
      </ul>
    </section>
    <section>
      <h2>2. Para que usamos</h2>
      <ul>
        <li>Fazer o serviço funcionar: exibir seu conteúdo, entregar mensagens e notificações.</li>
        <li>Segurança da conta: lista de aparelhos, aviso de acesso novo e limite de tentativas para frear abuso. A diferença de local gera apenas um aviso, nunca bloqueio automático.</li>
        <li>Personalizar o feed “Para você” com a sua atividade de leitura. Você pode desligar em Configurações, Privacidade; ao desligar, o histórico é apagado na hora.</li>
        <li>Moderação e cumprimento de obrigações legais.</li>
      </ul>
      <p className="mt-2">Não vendemos seus dados e não os usamos para publicidade.</p>
    </section>
    <section>
      <h2>3. Por quanto tempo guardamos</h2>
      <ul>
        <li>Registros de sessão (IP e localização): até 6 meses.</li>
        <li>Atividade de leitura: até 90 dias.</li>
        <li>Mensagens temporárias: apagadas depois do prazo escolhido na conversa.</li>
        <li>Conta excluída: após os 30 dias de arrependimento, apagamos conteúdo, relações e arquivos. Mensagens enviadas e recebidas somem também para a outra pessoa.</li>
        <li>Dados de moderação (denúncias e suspensões) podem ser mantidos pelo tempo necessário para o exercício regular de direitos e para cumprir obrigações legais.</li>
      </ul>
    </section>
    <section>
      <h2>4. Com quem compartilhamos</h2>
      <ul>
        <li><strong>Cloudflare:</strong> hospedagem, banco de dados, armazenamento de arquivos e proteção contra robôs.</li>
        <li><strong>Giphy:</strong> busca de GIFs e figurinhas no chat.</li>
        <li><strong>Google:</strong> somente se você escolher entrar com a conta Google.</li>
        <li>Autoridades, quando houver ordem judicial ou obrigação legal.</li>
      </ul>
    </section>
    <section>
      <h2>5. Seus direitos (LGPD)</h2>
      <p>Você pode confirmar e acessar seus dados, corrigi-los, pedir a eliminação, levar uma cópia (portabilidade), saber com quem compartilhamos e revogar consentimentos.</p>
      <ul>
        <li><strong>Baixar meus dados:</strong> Central de contas, no menu de configurações.</li>
        <li><strong>Corrigir:</strong> Editar perfil e informações do perfil.</li>
        <li><strong>Excluir a conta:</strong> Central de contas, com 30 dias para desistir.</li>
        <li><strong>Outros pedidos ou dúvidas:</strong> <Link to="/suporte/contato">fale com o suporte</Link> escolhendo “Meus dados”. Respondemos em até 15 dias.</li>
      </ul>
    </section>
    <section>
      <h2>6. Crianças e adolescentes</h2>
      <p>O Espectro não é destinado a menores de 13 anos e não coletamos dados deles de propósito. Se soubermos que uma conta pertence a alguém abaixo dessa idade, ela será excluída. Responsáveis podem pedir a exclusão pelo <Link to="/suporte/contato">suporte</Link>. No cadastro guardamos a data em que você declarou ter a idade mínima e aceitou os termos.</p>
    </section>
    <section>
      <h2>7. Segurança</h2>
      <p>Usamos conexão criptografada, senhas com proteção irreversível, limite de tentativas, verificação em duas etapas opcional e sessões que você pode encerrar a qualquer momento. Nenhum sistema é totalmente imune a falhas; se houver um incidente relevante, avisaremos as pessoas afetadas.</p>
    </section>
    <section>
      <h2>8. Mudanças nesta política</h2>
      <p>Podemos atualizar esta política. A data de atualização fica no topo da página.</p>
    </section>
  </Shell>
);
