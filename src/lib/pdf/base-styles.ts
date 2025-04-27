
export const baseStyles = `
  /* Import Source Sans 3 font */
  @import url('https://fonts.googleapis.com/css2?family=Source+Sans+3:wght@300;400;500;600;700&display=swap');
  
  /* Font declaration */
  @font-face {
    font-family: 'Source Sans 3';
    src: url('https://fonts.googleapis.com/css2?family=Source+Sans+3:wght@300;400;500;600;700&display=swap');
    font-display: swap;
  }
  
  body { 
    font-family: 'Source Sans 3', sans-serif; 
    color: #333;
    line-height: 1.5;
    font-size: 12pt;
  }
  
  h1 {
    font-size: 20pt;
    font-weight: 600;
    margin-bottom: 0.5cm;
  }
  
  h2 {
    font-size: 16pt;
    font-weight: 600;
    margin-top: 1cm;
    margin-bottom: 0.5cm;
  }
  
  h3 {
    font-size: 14pt;
    font-weight: 500;
    margin-bottom: 0.3cm;
  }
  
  p {
    margin-bottom: 0.3cm;
  }
  
  .artwork-image-container {
    text-align: center;
    margin-bottom: 1cm;
  }
  
  .artwork-image {
    max-width: 100%;
    max-height: 40%;
    object-fit: contain;
  }
  
  .artist-name {
    font-weight: bold;
    font-size: 14pt;
    margin-bottom: 0.2cm;
  }
  
  .artwork-title {
    font-style: italic;
    font-size: 13pt;
    margin-bottom: 0.8cm;
  }
`;
