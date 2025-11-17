 
export interface MetaPixel {
  id: string;
  name: string;
  pixelId: string;
  accessToken?: string;
}

export const loadMetaPixel = (pixel: MetaPixel) => {
  // Verificar se o pixel já foi carregado
  if (typeof window !== 'undefined' && (window as any).fbq) {
    return;
  }

  // Criar o script do Facebook Pixel
  const script = document.createElement('script');
  script.innerHTML = `
    !function(f,b,e,v,n,t,s)
    {if(f.fbq)return;n=f.fbq=function(){n.callMethod?
    n.callMethod.apply(n,arguments):n.queue.push(arguments)};
    if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
    n.queue=[];t=b.createElement(e);t.async=!0;
    t.src=v;s=b.getElementsByTagName(e)[0];
    s.parentNode.insertBefore(t,s)}(window, document,'script',
    'https://connect.facebook.net/en_US/fbevents.js');
    
    fbq('init', '${pixel.pixelId}');
    fbq('track', 'PageView');
  `;

  // Adicionar o script ao head
  document.head.appendChild(script);

  // Adicionar noscript para fallback
  const noscript = document.createElement('noscript');
  const img = document.createElement('img');
  img.height = 1;
  img.width = 1;
  img.style.display = 'none';
  img.src = `https://www.facebook.com/tr?id=${pixel.pixelId}&ev=PageView&noscript=1`;
  noscript.appendChild(img);
  document.head.appendChild(noscript);
};

export const trackEvent = (eventName: string, eventData: any) => {
  if (typeof window !== 'undefined' && (window as any).fbq) {
    (window as any).fbq('track', eventName, eventData);
  }
};