
interface TemplateStyles {
  classic: string;
  modern: string;
  minimal: string;
  elegant: string;
  professional: string;
}

export const baseStyles = `
  body { 
    font-family: Arial, sans-serif; 
    margin: 0;
    padding: 0;
    color: #333;
    line-height: 1.6;
  }
  .detail-label {
    font-weight: bold;
    color: #18465a;
    margin-right: 8px;
  }
  @media print {
    body { margin: 0; padding: 0; }
  }
`;

export const templateStyles: TemplateStyles = {
  classic: `
    h1 { 
      color: #18465a;
      font-size: 24px;
      margin-bottom: 20px;
      padding-bottom: 10px;
      border-bottom: 2px solid #18465a;
    }
    .detail { 
      margin-bottom: 15px;
      padding: 12px;
      background: #f8f9fa;
      border-radius: 6px;
    }
    .section {
      margin-bottom: 30px;
    }
  `,
  modern: `
    h1 { 
      color: #18465a;
      font-size: 28px;
      font-weight: 300;
      margin-bottom: 30px;
    }
    .detail { 
      margin-bottom: 20px;
      padding-left: 15px;
      border-left: 3px solid #18465a;
    }
    .section {
      margin-bottom: 40px;
    }
  `,
  minimal: `
    h1 { 
      text-transform: uppercase;
      letter-spacing: 3px;
      font-size: 20px;
      margin-bottom: 30px;
      font-weight: normal;
    }
    .detail { 
      margin-bottom: 15px;
      padding-bottom: 15px;
      border-bottom: 1px solid #eee;
    }
    .detail-label {
      text-transform: uppercase;
      font-size: 12px;
      letter-spacing: 1px;
      display: block;
      margin-bottom: 5px;
    }
    .section {
      margin-bottom: 30px;
    }
  `,
  elegant: `
    h1 { 
      font-family: "Times New Roman", serif;
      color: #18465a;
      font-size: 32px;
      margin-bottom: 25px;
      text-align: center;
      font-style: italic;
    }
    .detail { 
      margin-bottom: 20px;
      padding: 15px;
      border: 1px solid #dee2e6;
      background: #fff;
    }
    .detail-label {
      color: #18465a;
      font-family: "Times New Roman", serif;
      font-style: italic;
    }
    .section {
      margin-bottom: 35px;
      padding: 0 20px;
    }
  `,
  professional: `
    h1 { 
      color: #18465a;
      font-size: 26px;
      margin-bottom: 25px;
      padding-bottom: 15px;
      border-bottom: 3px double #18465a;
    }
    .detail { 
      margin-bottom: 18px;
      padding: 12px 15px;
      background: linear-gradient(to right, #f8f9fa, white);
      border-radius: 4px;
    }
    .detail-label {
      color: #18465a;
      font-weight: 600;
      text-transform: uppercase;
      font-size: 0.9em;
    }
    .section {
      margin-bottom: 35px;
    }
  `
};

export function getStationeryStyle(useStationery: boolean): string {
  return useStationery ? `
    body {
      background-image: url('/lovable-uploads/55e90a54-96c5-47d5-8767-03b4347e6942.png');
      background-size: contain;
      background-repeat: no-repeat;
      background-position: center;
      position: relative;
    }
    .content-wrapper {
      position: relative;
      z-index: 1;
      background: rgba(255, 255, 255, 0.95);
      padding: 40px;
    }
  ` : '';
}
