
export const baseStyles = `
  @import url('https://fonts.googleapis.com/css2?family=Source+Sans+3:wght@300;400;500;600;700&display=swap');
  
  @font-face {
    font-family: 'Source Sans 3';
    src: url('https://fonts.googleapis.com/css2?family=Source+Sans+3:wght@300;400;500;600;700&display=swap');
    font-display: swap;
  }
  
  body { 
    font-family: 'Source Sans 3', sans-serif; 
    margin: 0;
    padding: 0;
    color: #333;
    line-height: 1.4;
  }
  
  .detail-label {
    font-weight: 600;
    color: #18465a;
    margin-right: 8px;
  }
  
  h1, h2, h3, h4, h5, h6 {
    font-family: 'Source Sans 3', sans-serif;
  }
  
  @media print {
    body { margin: 0; padding: 0; }
  }
`;
