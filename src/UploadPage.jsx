import { useState, useEffect } from 'react';
import axios from 'axios';

export default function UploadPage() {
  const [file, setFile] = useState(null);
  const [totalPages, setTotalPages] = useState(0);
  const [copies, setCopies] = useState(1);
  const [duplex, setDuplex] = useState('single');
  const [price, setPrice] = useState(0);
  const [message, setMessage] = useState('');
  const [jobId, setJobId] = useState(null);
  const [loading, setLoading] = useState(false);
  const [payLoading, setPayLoading] = useState(false);
  const [showThankYou, setShowThankYou] = useState(false);
  const [finalToken, setFinalToken] = useState('');
  const [paymentMode, setPaymentMode] = useState('');

  const [printRange, setPrintRange] = useState('all');
  const [customPages, setCustomPages] = useState('');

  const API_BASE_URL =
    import.meta.env.VITE_API_URL ||
    import.meta.env.VITE_API_BASE_URL ||
    'http://localhost:5000';

  const printType =
    duplex === 'single' ? 'single' :
    duplex === 'long' ? 'duplex_long' :
    'duplex_short';

  const getBillablePages = () => {
    if (printRange === 'all' || !customPages) return totalPages;

    let pages = [];

    customPages.split(',').forEach((part) => {
      part = part.trim();

      if (part.includes('-')) {
        const [start, end] = part.split('-').map(Number);
        if (start && end && start <= end) {
          for (let i = start; i <= end; i++) pages.push(i);
        }
      } else if (part) {
        const pageNum = Number(part);
        if (pageNum) pages.push(pageNum);
      }
    });

    return [...new Set(pages)].filter((p) => p >= 1 && p <= totalPages).length;
  };

  const billablePages = getBillablePages();

  const calculateLocalPrice = (pages, side, copyCount) => {
    if (pages <= 0) return 0;

    let rate = pages <= 5 ? 5 : side === 'single' ? 3 : 3.5;
    let billableUnits = side === 'single' ? pages : Math.ceil(pages / 2);

    return Math.round(billableUnits * rate * Number(copyCount || 1));
  };

  useEffect(() => {
    if (totalPages > 0) {
      setPrice(calculateLocalPrice(billablePages, duplex, copies));
    }
  }, [copies, duplex, totalPages, printRange, customPages]);

  const loadRazorpayScript = () => {
    return new Promise((resolve) => {
      if (window.Razorpay) return resolve(true);

      const script = document.createElement('script');
      script.src = 'https://checkout.razorpay.com/v1/checkout.js';
      script.onload = () => resolve(true);
      script.onerror = () => resolve(false);
      document.body.appendChild(script);
    });
  };

  const resetOrder = () => {
    setFile(null);
    setTotalPages(0);
    setCopies(1);
    setDuplex('single');
    setPrice(0);
    setMessage('');
    setJobId(null);
    setPrintRange('all');
    setCustomPages('');
    setShowThankYou(false);
    setFinalToken('');
    setPaymentMode('');
  };

  const handleFileChange = (e) => {
    const selectedFile = e.target.files[0];
    if (!selectedFile) return;

    const name = selectedFile.name.toLowerCase();
    const isValid =
      selectedFile.type.includes('pdf') ||
      selectedFile.type.includes('image') ||
      name.endsWith('.pdf') ||
      name.endsWith('.jpg') ||
      name.endsWith('.jpeg') ||
      name.endsWith('.png');

    if (!isValid) {
      setMessage('ફક્ત PDF અથવા Photo જ અપલોડ કરો ❌');
      e.target.value = '';
      return;
    }

    setFile(selectedFile);
    setJobId(null);
    setMessage('');
    setTotalPages(0);
    setPrice(0);
    setPrintRange('all');
    setCustomPages('');
  };

  const handleUpload = async () => {
    if (!file) {
      setMessage('Please select a file first');
      return;
    }

    const formData = new FormData();
    formData.append('file', file);

    setMessage('Uploading...');
    setLoading(true);

    try {
      const res = await axios.post(`${API_BASE_URL}/api/upload`, formData);
      setTotalPages(res.data.pages || 1);
      setJobId(res.data.jobId);
      setMessage('File uploaded successfully ✅');
    } catch (error) {
      console.log(error);
      setMessage(error.response?.data?.error || 'Upload failed ❌');
    } finally {
      setLoading(false);
    }
  };

  const handlePay = async () => {
    if (!jobId) {
      setMessage('Please upload a file first');
      return;
    }

    if (billablePages <= 0) {
      setMessage('Valid pages select કરો ❌');
      return;
    }

    const loaded = await loadRazorpayScript();
    if (!loaded) {
      setMessage('Razorpay load failed. Internet check કરો.');
      return;
    }

    setPayLoading(true);

    try {
      setMessage('Opening payment...');

      const orderRes = await axios.post(
        `${API_BASE_URL}/api/jobs/${jobId}/pay/checkout-order`,
        {
          copies: Number(copies || 1),
          printType,
          printRange,
          customPages
        }
      );

      const data = orderRes.data;

      const options = {
        key: data.keyId,
        amount: data.amount,
        currency: data.currency || 'INR',
        name: data.shopName || 'Falguni Xerox',
        description: `${billablePages} Pages × ${copies} Copy`,
        order_id: data.orderId,

        handler: async function (response) {
          try {
            setMessage('Payment verifying...');

            const verifyRes = await axios.post(`${API_BASE_URL}/api/payment/verify`, {
              jobId,
              razorpay_order_id: response.razorpay_order_id,
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_signature: response.razorpay_signature
            });

            setFinalToken(verifyRes.data.token || jobId);
            setPaymentMode('Online Paid');
            setShowThankYou(true);
            setMessage('');
          } catch (err) {
            console.log(err);
            setMessage('Payment done but verify failed. Counter પર બતાવો.');
          }
        },

        modal: {
          ondismiss: function () {
            setMessage('Payment cancelled. Cash option use કરી શકો છો.');
            setPayLoading(false);
          }
        },

        theme: {
          color: '#0a8f08'
        }
      };

      const rzp = new window.Razorpay(options);

      rzp.on('payment.failed', function () {
        setMessage('Payment failed. You can Pay Cash at Counter.');
        setPayLoading(false);
      });

      rzp.open();
    } catch (error) {
      console.log(error);
      setMessage(error.response?.data?.error || 'Payment order create failed ❌');
      setPayLoading(false);
    }
  };

  const handleCashPayment = async () => {
    if (!jobId) {
      setMessage('Please upload a file first');
      return;
    }

    if (billablePages <= 0) {
      setMessage('Valid pages select કરો ❌');
      return;
    }

    setPayLoading(true);

    try {
      setMessage('Creating cash order...');

      const res = await axios.post(`${API_BASE_URL}/api/jobs/${jobId}/cash`, {
        copies: Number(copies || 1),
        printType,
        printRange,
        customPages
      });

      setFinalToken(res.data.token || jobId);
      setPaymentMode('Cash Pending');
      setShowThankYou(true);
      setMessage('');
    } catch (error) {
      console.log(error);
      setMessage(error.response?.data?.error || 'Cash order failed ❌');
    } finally {
      setPayLoading(false);
    }
  };

  const totalSheets =
    duplex === 'single'
      ? billablePages * Number(copies || 1)
      : Math.ceil(billablePages / 2) * Number(copies || 1);

  const getPriceBreakdown = () => {
    if (totalPages <= 0) return '';

    const rate = billablePages <= 5 ? 5 : duplex === 'single' ? 3 : 3.5;
    const billableUnits =
      duplex === 'single' ? billablePages : Math.ceil(billablePages / 2);
    const unitName = duplex === 'single' ? 'Pages' : 'Sheets';

    return `${billableUnits} ${unitName} × ₹${rate} × ${copies} Copy`;
  };

  if (showThankYou) {
    return (
      <div className="container" style={{ padding: '20px', maxWidth: '500px', margin: '0 auto', textAlign: 'center' }}>
        <div style={{ padding: '40px 20px', border: '2px solid #0a8f08', borderRadius: '12px', background: '#f0fff0' }}>
          <h1 style={{ fontSize: '48px', margin: '0' }}>✅</h1>
          <h2 style={{ color: '#0a8f08', margin: '20px 0' }}>
            Thank you for using Falguni Xerox!
          </h2>

          <p style={{ fontSize: '18px', margin: '10px 0' }}>Your Token Number:</p>
          <h1 style={{ fontSize: '42px', margin: '10px 0', color: '#ff9800' }}>
            #{finalToken}
          </h1>

          <p style={{ fontSize: '16px', color: '#333' }}>
            Payment: <b>{paymentMode}</b>
          </p>

          {paymentMode === 'Cash Pending' ? (
            <p style={{ fontSize: '15px', color: '#666' }}>
              કાઉન્ટર પર Cash આપો. Admin confirm કર્યા પછી print થશે.
            </p>
          ) : (
            <p style={{ fontSize: '15px', color: '#666' }}>
              Printing Started... કાઉન્ટર પરથી તમારી પ્રિન્ટ લઈ લો.
            </p>
          )}

          <button
            onClick={resetOrder}
            style={{
              marginTop: '30px',
              background: '#0a8f08',
              color: 'white',
              padding: '12px 30px',
              fontSize: '16px',
              border: 'none',
              borderRadius: '8px',
              cursor: 'pointer',
              fontWeight: 'bold'
            }}
          >
            New Order
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="container" style={{ padding: '20px', maxWidth: '500px', margin: '0 auto' }}>
      <h1>🖨️ Falguni Xerox</h1>

      <div className="step" style={{ marginBottom: '20px', padding: '15px', border: '1px solid #ddd', borderRadius: '8px' }}>
        <h2>1. Upload File</h2>

        <input
          type="file"
          onChange={handleFileChange}
          accept=".pdf,.jpg,.jpeg,.png"
          disabled={loading}
        />

        <button
          onClick={handleUpload}
          disabled={loading || !file}
          style={{ marginLeft: '10px', padding: '8px 16px' }}
        >
          {loading ? 'Uploading...' : 'Upload'}
        </button>
      </div>

      {message && (
        <p
          style={{
            padding: '10px',
            background: message.includes('✅') ? '#d4edda' : '#f8d7da',
            borderRadius: '5px',
            color: message.includes('✅') ? '#155724' : '#721c24',
            whiteSpace: 'pre-line'
          }}
        >
          {message}
        </p>
      )}

      {totalPages > 0 && (
        <div className="step" style={{ marginBottom: '20px', padding: '15px', border: '1px solid #ddd', borderRadius: '8px' }}>
          <h2>2. Print Settings</h2>

          <p><strong>Total Pages: {totalPages}</strong></p>
          <p><strong>Billable Pages: {billablePages}</strong></p>
          <p><strong>Total Sheets: {totalSheets}</strong></p>

          <div style={{ margin: '15px 0', padding: '10px', background: '#f9f9f9', borderRadius: '5px' }}>
            <p><b>Select Pages to Print:</b></p>

            <label style={{ display: 'block', margin: '8px 0', cursor: 'pointer' }}>
              <input
                type="radio"
                checked={printRange === 'all'}
                onChange={() => setPrintRange('all')}
                style={{ marginRight: '8px' }}
              />
              All Pages ({totalPages})
            </label>

            <label style={{ display: 'block', margin: '8px 0', cursor: 'pointer' }}>
              <input
                type="radio"
                checked={printRange === 'custom'}
                onChange={() => setPrintRange('custom')}
                style={{ marginRight: '8px' }}
              />
              Custom Pages:
            </label>

            <input
              type="text"
              placeholder="e.g. 2,4,7-10"
              value={customPages}
              disabled={printRange === 'all'}
              onChange={(e) => setCustomPages(e.target.value)}
              style={{ marginLeft: '25px', width: '200px', padding: '5px' }}
            />

            {printRange === 'custom' && customPages && (
              <p style={{ fontSize: '12px', color: billablePages > 0 ? '#666' : 'red', marginLeft: '25px' }}>
                Selected: {billablePages} pages
              </p>
            )}
          </div>

          <div style={{ margin: '15px 0' }}>
            <label>
              <b>Copies: </b>
              <input
                type="number"
                value={copies}
                min="1"
                max="99"
                onChange={(e) => {
                  const num = parseInt(e.target.value);
                  setCopies(!isNaN(num) && num >= 1 ? num : 1);
                }}
                style={{ marginLeft: '10px', width: '60px', padding: '5px' }}
              />
            </label>
          </div>

          <div style={{ margin: '15px 0' }}>
            <p><b>Select Print Type:</b></p>

            <label style={{ display: 'block', margin: '8px 0', cursor: 'pointer' }}>
              <input
                type="radio"
                name="duplex"
                value="single"
                checked={duplex === 'single'}
                onChange={(e) => setDuplex(e.target.value)}
                style={{ marginRight: '8px' }}
              />
              Single Side Print
            </label>

            <label style={{ display: 'block', margin: '8px 0', cursor: 'pointer' }}>
              <input
                type="radio"
                name="duplex"
                value="long"
                checked={duplex === 'long'}
                onChange={(e) => setDuplex(e.target.value)}
                style={{ marginRight: '8px' }}
              />
              Double Side - Long Edge
            </label>

            <label style={{ display: 'block', margin: '8px 0', cursor: 'pointer' }}>
              <input
                type="radio"
                name="duplex"
                value="short"
                checked={duplex === 'short'}
                onChange={(e) => setDuplex(e.target.value)}
                style={{ marginRight: '8px' }}
              />
              Double Side - Short Edge
            </label>
          </div>

          <div style={{ background: '#f0f0f0', padding: '15px', borderRadius: '8px', marginTop: '15px' }}>
            <h3 style={{ margin: '0 0 5px 0' }}>Total Price: ₹{price}</h3>
            <p style={{ margin: '0', fontSize: '14px', color: '#666' }}>
              {getPriceBreakdown()}
            </p>
          </div>
        </div>
      )}

      {price > 0 && jobId && (
        <div className="step" style={{ marginBottom: '20px', padding: '15px', border: '1px solid #ddd', borderRadius: '8px' }}>
          <h2>3. Payment</h2>

          <button
            onClick={handlePay}
            disabled={payLoading}
            style={{
              width: '100%',
              background: '#0a8f08',
              color: 'white',
              padding: '15px 20px',
              fontSize: '18px',
              border: 'none',
              borderRadius: '8px',
              cursor: 'pointer',
              fontWeight: 'bold'
            }}
          >
            {payLoading ? 'Please wait...' : `Pay Online ₹${price}`}
          </button>

          <button
            onClick={handleCashPayment}
            disabled={payLoading}
            style={{
              width: '100%',
              background: '#ff9800',
              color: 'white',
              padding: '15px 20px',
              fontSize: '18px',
              border: 'none',
              borderRadius: '8px',
              cursor: 'pointer',
              fontWeight: 'bold',
              marginTop: '10px'
            }}
          >
            Pay Cash at Counter
          </button>

          <p style={{ fontSize: '12px', color: '#666', marginTop: '10px', textAlign: 'center' }}>
            Online payment failed? Cash option use કરો.
          </p>
        </div>
      )}
    </div>
  );
}