import { useState, useEffect } from 'react';
import axios from 'axios';

export default function UploadPage() {
  const [file, setFile] = useState(null);
  const [filePreviewUrl, setFilePreviewUrl] = useState('');
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
  const [showPaymentHelp, setShowPaymentHelp] = useState(false);
  const [printRange, setPrintRange] = useState('all');
  const [customPages, setCustomPages] = useState('');
  const [redirectCount, setRedirectCount] = useState(10);

  const API_BASE_URL =
    import.meta.env.VITE_API_URL ||
    import.meta.env.VITE_API_BASE_URL ||
    'http://localhost:10000';

  const printType =
    duplex === 'single' ? 'single' : duplex === 'long' ? 'duplex_long' : 'duplex_short';

  const safeCopies = Math.min(Math.max(Number(copies || 1), 1), 99);
  const isPdf = file?.name?.toLowerCase().endsWith('.pdf');

  const getBillablePages = () => {
    if (printRange === 'all' || !customPages) return totalPages;

    let pages = [];
    customPages.split(',').forEach((part) => {
      const clean = part.trim();
      if (clean.includes('-')) {
        const [start, end] = clean.split('-').map(Number);
        if (start && end && start <= end) {
          for (let i = start; i <= end; i++) pages.push(i);
        }
      } else {
        const pageNum = Number(clean);
        if (pageNum) pages.push(pageNum);
      }
    });

    return [...new Set(pages)].filter((p) => p >= 1 && p <= totalPages).length;
  };

  const billablePages = getBillablePages();

  const calculateLocalPrice = (pages, side, copyCount) => {
    if (pages <= 0) return 0;
    const isDuplexPrint = side === 'long' || side === 'short';
    const rate = pages <= 5 ? 5 : isDuplexPrint ? 3.5 : 3;
    const units = isDuplexPrint ? Math.ceil(pages / 2) : pages;
    return Math.round(units * rate * Number(copyCount || 1));
  };

  useEffect(() => {
    if (totalPages > 0) {
      setPrice(calculateLocalPrice(billablePages, duplex, safeCopies));
    }
  }, [copies, duplex, totalPages, printRange, customPages, billablePages, safeCopies]);

  useEffect(() => {
    return () => {
      if (filePreviewUrl) URL.revokeObjectURL(filePreviewUrl);
    };
  }, [filePreviewUrl]);

  useEffect(() => {
    if (!showThankYou) return;
    const timer = setInterval(() => {
      setRedirectCount((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          resetOrder();
          return 10;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [showThankYou]);

  const totalSheets =
    duplex === 'single'
      ? billablePages * safeCopies
      : Math.ceil(billablePages / 2) * safeCopies;

  const getPriceBreakdown = () => {
    if (totalPages <= 0) return '';
    const isDuplexPrint = duplex === 'long' || duplex === 'short';
    const rate = billablePages <= 5 ? 5 : isDuplexPrint ? 3.5 : 3;
    const units = isDuplexPrint ? Math.ceil(billablePages / 2) : billablePages;
    const unitName = isDuplexPrint ? 'Sheets' : 'Pages';
    return `${units} ${unitName} × Rs. ${rate} × ${safeCopies} Copy`;
  };

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
    setFilePreviewUrl('');
    setTotalPages(0);
    setCopies(1);
    setDuplex('single');
    setPrice(0);
    setMessage('');
    setJobId(null);
    setLoading(false);
    setPayLoading(false);
    setPrintRange('all');
    setCustomPages('');
    setShowThankYou(false);
    setFinalToken('');
    setPaymentMode('');
    setShowPaymentHelp(false);
    setRedirectCount(10);
  };

  const updateCopies = (value) => {
    if (value === '') {
      setCopies('');
      return;
    }
    const num = parseInt(value, 10);
    if (Number.isNaN(num)) {
      setCopies(1);
      return;
    }
    setCopies(Math.min(Math.max(num, 1), 99));
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
      setMessage('Only PDF, JPG, JPEG, PNG files allowed ❌');
      e.target.value = '';
      return;
    }

    if (selectedFile.size > 50 * 1024 * 1024) {
      setMessage('Max file size 50MB allowed ❌');
      e.target.value = '';
      return;
    }

    if (filePreviewUrl) URL.revokeObjectURL(filePreviewUrl);

    setFile(selectedFile);
    setFilePreviewUrl(URL.createObjectURL(selectedFile));
    setJobId(null);
    setMessage('');
    setShowPaymentHelp(false);
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

    setMessage('Uploading your file...');
    setShowPaymentHelp(false);
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
      setMessage('Please select valid pages ❌');
      return;
    }

    const loaded = await loadRazorpayScript();
    if (!loaded) {
      setShowPaymentHelp(true);
      setMessage('Payment system load failed. Please check your internet.');
      return;
    }

    setPayLoading(true);
    setShowPaymentHelp(false);

    try {
      setMessage('Opening secure payment...');

      const orderRes = await axios.post(
        `${API_BASE_URL}/api/jobs/${jobId}/pay/checkout-order`,
        {
          copies: safeCopies,
          printType,
          printRange,
          customPages,
        }
      );

      const data = orderRes.data;

      const options = {
        key: data.keyId,
        amount: data.amount,
        currency: data.currency || 'INR',
        name: data.shopName || 'Falguni Xerox',
        description: `${billablePages} Pages × ${safeCopies} Copy`,
        order_id: data.orderId,
        method: {
          upi: true,
          card: false,
          netbanking: false,
          wallet: false,
          paylater: false,
        },
        handler: async function (response) {
          try {
            setMessage('Payment verifying...');
            const verifyRes = await axios.post(`${API_BASE_URL}/api/payment/verify`, {
              jobId,
              razorpay_order_id: response.razorpay_order_id,
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_signature: response.razorpay_signature,
            });

            setFinalToken(verifyRes.data.token || jobId);
            setPaymentMode('Online Paid');
            setShowPaymentHelp(false);
            setShowThankYou(true);
            setMessage('');
          } catch (err) {
            console.log(err);
            setShowPaymentHelp(true);
            setMessage('Payment done but verification failed. Please show this at counter.');
          } finally {
            setPayLoading(false);
          }
        },
        modal: {
          ondismiss: function () {
            setMessage('Payment cancelled. Try again or use Cash option.');
            setShowPaymentHelp(true);
            setPayLoading(false);
          },
        },
        theme: {
          color: '#6d28d9',
        },
      };

      const rzp = new window.Razorpay(options);

      rzp.on('payment.failed', function () {
        setShowPaymentHelp(true);
        setMessage('Payment failed. Select Show All Options → Apps & UPI ID.');
        setPayLoading(false);
      });

      rzp.open();
    } catch (error) {
      console.log(error);
      setShowPaymentHelp(true);
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
      setMessage('Please select valid pages ❌');
      return;
    }

    setPayLoading(true);
    setShowPaymentHelp(false);

    try {
      setMessage('Creating cash order...');
      const res = await axios.post(`${API_BASE_URL}/api/jobs/${jobId}/cash`, {
        copies: safeCopies,
        printType,
        printRange,
        customPages,
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

  if (showThankYou) {
    return (
      <div style={styles.page}>
        <div style={styles.app}>
          <div style={styles.successCard}>
            <div style={styles.successIcon}>✅</div>
            <h2 style={styles.successTitle}>Order Received</h2>
            <p>Your Token Number</p>
            <div style={styles.tokenBox}>#{finalToken}</div>
            <div style={styles.successStatus}>
              <span>Payment</span>
              <b>{paymentMode}</b>
            </div>
            <p style={styles.successNote}>
              {paymentMode === 'Cash Pending'
                ? 'Please pay cash at the counter. Your print will start after admin confirmation.'
                : 'Printing started. Please collect your print from the counter.'}
            </p>
            <p style={styles.redirectText}>New order screen will open in {redirectCount} seconds.</p>
            <button onClick={resetOrder} style={styles.successButton}>
              New Order
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={styles.page}>
      <div style={styles.app}>
        <header style={styles.header}>
          <div>
            <h1 style={styles.brandTitle}>Falguni Xerox</h1>
            <p style={styles.brandSub}>Upload • Select • Pay • Print</p>
          </div>
          <div style={styles.printerIcon}>🖨️</div>
        </header>

        <div style={styles.steps}>
          <span style={jobId ? styles.stepDone : styles.stepActive}>1 Upload</span>
          <span style={totalPages > 0 ? styles.stepActive : styles.step}>2 Setting</span>
          <span style={price > 0 ? styles.stepActive : styles.step}>3 Pay</span>
        </div>

        {totalPages <= 0 && (
          <>
            <section style={styles.uploadMainCard}>
              <div style={styles.bigFileIcon}>📄</div>
              <h2 style={styles.uploadTitle}>Upload File</h2>
              <p style={styles.uploadSub}>PDF, JPG, JPEG, PNG</p>
              <p style={styles.uploadSub}>Max 50MB</p>

              <label style={styles.dropBox}>
                <input
                  type="file"
                  onChange={handleFileChange}
                  accept=".pdf,.jpg,.jpeg,.png"
                  disabled={loading}
                  style={{ display: 'none' }}
                />
                <div style={styles.folderIcon}>📁</div>
                <b>{file ? file.name : 'Select File'}</b>
                <span>{file ? 'File selected successfully' : 'or tap here to browse'}</span>
              </label>

              <button
                onClick={handleUpload}
                disabled={loading || !file}
                style={{
                  ...styles.uploadPayButton,
                  opacity: loading || !file ? 0.65 : 1,
                  cursor: loading || !file ? 'not-allowed' : 'pointer',
                }}
              >
                {loading ? 'Uploading...' : 'Upload & Pay કરો'} <span>›</span>
              </button>
            </section>

            {message && <div style={styles.messageBox}>{message}</div>}
            <FeatureBox compact />
          </>
        )}

        {totalPages > 0 && (
          <>
            <section style={styles.panel}>
              <div style={styles.sectionTitle}>
                <span style={styles.sectionIcon}>📄</span>
                <h2 style={styles.panelTitle}>Print Type</h2>
              </div>

              <button
                onClick={() => setDuplex('single')}
                style={duplex === 'single' ? styles.printSelected : styles.printButton}
              >
                <span>{duplex === 'single' ? '◉' : '○'}</span> Single Side
              </button>

              <button
                onClick={() => setDuplex('long')}
                style={duplex === 'long' ? styles.printSelected : styles.printButton}
              >
                <span>{duplex === 'long' ? '◉' : '○'}</span> Double Side - Long Edge
              </button>

              <button
                onClick={() => setDuplex('short')}
                style={duplex === 'short' ? styles.printSelected : styles.printButton}
              >
                <span>{duplex === 'short' ? '◉' : '○'}</span> Double Side - Short Edge
              </button>
            </section>

            <section style={styles.panel}>
              <div style={styles.sectionTitle}>
                <span style={styles.sectionIcon}>🧾</span>
                <h2 style={styles.panelTitle}>Copies</h2>
              </div>

              <div style={styles.copyBox}>
                <button
                  type="button"
                  onClick={() => updateCopies(safeCopies - 1)}
                  disabled={safeCopies <= 1}
                  style={styles.copyButton}
                >
                  −
                </button>

                <input
                  type="number"
                  value={copies}
                  min="1"
                  max="99"
                  inputMode="numeric"
                  onChange={(e) => updateCopies(e.target.value)}
                  onBlur={() => {
                    if (!copies || Number(copies) < 1) setCopies(1);
                    if (Number(copies) > 99) setCopies(99);
                  }}
                  style={styles.copyInput}
                />

                <button
                  type="button"
                  onClick={() => updateCopies(safeCopies + 1)}
                  disabled={safeCopies >= 99}
                  style={styles.copyButton}
                >
                  +
                </button>
              </div>
            </section>

            {isPdf && (
              <section style={styles.panel}>
                <div style={styles.sectionTitle}>
                  <span style={styles.sectionIcon}>📑</span>
                  <h2 style={styles.panelTitle}>Pages</h2>
                </div>

                <div style={styles.pageButtons}>
                  <button
                    onClick={() => setPrintRange('all')}
                    style={printRange === 'all' ? styles.pageSelected : styles.pageButton}
                  >
                    All Pages
                  </button>
                  <button
                    onClick={() => setPrintRange('custom')}
                    style={printRange === 'custom' ? styles.pageSelected : styles.pageButton}
                  >
                    Custom
                  </button>
                </div>

                {printRange === 'custom' && (
                  <input
                    type="text"
                    placeholder="e.g. 2,4,7-10"
                    value={customPages}
                    onChange={(e) => setCustomPages(e.target.value)}
                    style={styles.customInput}
                  />
                )}
              </section>
            )}

            <section style={styles.amountCard}>
              <h2 style={styles.amountTitle}>Total Amount</h2>
              <b style={styles.amountValue}>Rs. {price}</b>
              <p style={styles.amountBreak}>{getPriceBreakdown()}</p>
              <small style={styles.amountSmall}>
                {billablePages} pages • {totalSheets} sheets
              </small>
            </section>

            <section style={styles.panel}>
              <div style={styles.sectionTitle}>
                <span style={styles.sectionIcon}>📱</span>
                <h2 style={styles.panelTitle}>Payment</h2>
              </div>

              <button onClick={handlePay} disabled={payLoading} style={styles.onlinePay}>
                <span>🔒</span>
                {payLoading ? 'Please wait...' : `Pay Online Rs. ${price}`}
                <b>›</b>
              </button>

              <button onClick={handleCashPayment} disabled={payLoading} style={styles.cashPay}>
                <span>💵</span>
                Pay Cash at Counter
              </button>

              {showPaymentHelp && (
                <div style={styles.helpBox}>
                  <b>If payment app does not open:</b>
                  <p>Select Show All Options → Apps &amp; UPI ID → Choose your UPI app.</p>
                </div>
              )}
            </section>

            {message && <div style={styles.messageBox}>{message}</div>}
            <FeatureBox />
          </>
        )}
      </div>
    </div>
  );
}

function FeatureBox({ compact = false }) {
  return (
    <div style={compact ? styles.featureBoxCompact : styles.featureBox}>
      <div>
        <span>⚡</span>
        <b>Fast</b>
        <p>Printing</p>
      </div>
      <div>
        <span>🛡️</span>
        <b>Secure</b>
        <p>Payment</p>
      </div>
      <div>
        <span>💎</span>
        <b>Best</b>
        <p>Quality</p>
      </div>
    </div>
  );
}

const styles = {
  page: {
    minHeight: '100dvh',
    background: 'linear-gradient(160deg, #1238e8 0%, #4c1dff 45%, #1700a8 100%)',
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'flex-start',
    fontFamily: '"Inter","Segoe UI",Roboto,Arial,sans-serif',
    color: '#ffffff',
  },

  app: {
    width: '100%',
    maxWidth: '430px',
    minHeight: '100dvh',
    padding: '22px 20px 14px',
    boxSizing: 'border-box',
    background:
      'radial-gradient(circle at top right, rgba(236,72,153,0.28), transparent 30%), linear-gradient(160deg, #1238e8 0%, #4c1dff 45%, #1700a8 100%)',
    color: '#ffffff',
  },

  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: '12px',
    marginBottom: '18px',
  },

  brandTitle: {
    margin: 0,
    fontSize: '34px',
    lineHeight: '40px',
    fontWeight: '900',
    color: '#ffffff',
    textShadow: '0 3px 12px rgba(0,0,0,0.25)',
  },

  brandSub: {
    margin: '8px 0 0',
    fontSize: '16px',
    color: '#ffffff',
    opacity: 0.96,
    fontWeight: '700',
  },

  printerIcon: {
    width: '54px',
    height: '54px',
    borderRadius: '50%',
    display: 'grid',
    placeItems: 'center',
    background: 'rgba(255,255,255,0.18)',
    fontSize: '26px',
    flexShrink: 0,
  },

  steps: {
    display: 'flex',
    justifyContent: 'center',
    gap: '9px',
    marginBottom: '22px',
  },

  step: {
    padding: '12px 17px',
    borderRadius: '999px',
    background: 'rgba(255,255,255,0.16)',
    color: '#ffffff',
    fontWeight: '800',
    fontSize: '14px',
  },

  stepActive: {
    padding: '12px 17px',
    borderRadius: '999px',
    background: '#ffffff',
    color: '#10105f',
    fontWeight: '900',
    fontSize: '14px',
  },

  stepDone: {
    padding: '12px 17px',
    borderRadius: '999px',
    background: 'rgba(255,255,255,0.26)',
    color: '#ffffff',
    fontWeight: '900',
    fontSize: '14px',
  },

  uploadMainCard: {
    borderRadius: '24px',
    padding: '28px 24px',
    border: '1px solid rgba(255,255,255,0.18)',
    background: 'rgba(255,255,255,0.08)',
    textAlign: 'center',
    color: '#ffffff',
  },

  bigFileIcon: {
    width: '78px',
    height: '78px',
    margin: '0 auto 20px',
    borderRadius: '22px',
    display: 'grid',
    placeItems: 'center',
    background: 'rgba(255,255,255,0.18)',
    fontSize: '38px',
  },

  uploadTitle: {
    margin: 0,
    fontSize: '30px',
    fontWeight: '900',
    color: '#ffffff',
  },

  uploadSub: {
    margin: '8px 0 0',
    fontSize: '18px',
    color: '#ffffff',
  },

  dropBox: {
    marginTop: '26px',
    minHeight: '162px',
    borderRadius: '22px',
    border: '2px dashed rgba(255,255,255,0.75)',
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'center',
    alignItems: 'center',
    gap: '10px',
    cursor: 'pointer',
    padding: '18px',
    boxSizing: 'border-box',
    wordBreak: 'break-word',
    color: '#ffffff',
  },

  folderIcon: {
    fontSize: '42px',
  },

  uploadPayButton: {
    width: '100%',
    marginTop: '26px',
    padding: '17px 20px',
    borderRadius: '18px',
    border: '1px solid rgba(255,255,255,0.28)',
    background: 'linear-gradient(90deg, #8b2cff, #ec26c9)',
    color: '#ffffff',
    fontSize: '20px',
    fontWeight: '900',
    boxShadow: '0 16px 34px rgba(0,0,0,0.22)',
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    gap: '14px',
  },

  panel: {
    borderRadius: '22px',
    padding: '18px',
    marginBottom: '14px',
    border: '1px solid rgba(255,255,255,0.18)',
    background: 'rgba(255,255,255,0.10)',
    color: '#ffffff',
  },

  sectionTitle: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    marginBottom: '16px',
    color: '#ffffff',
  },

  sectionIcon: {
    width: '34px',
    height: '34px',
    borderRadius: '10px',
    background: 'rgba(255,255,255,0.16)',
    display: 'grid',
    placeItems: 'center',
    color: '#ffffff',
  },

  panelTitle: {
    margin: 0,
    color: '#ffffff',
    fontSize: '22px',
    fontWeight: '900',
    textShadow: '0 2px 8px rgba(0,0,0,0.22)',
  },

  printButton: {
    width: '100%',
    padding: '16px',
    marginTop: '8px',
    borderRadius: '13px',
    border: 'none',
    background: '#ffffff',
    color: '#090b3f',
    fontSize: '16px',
    textAlign: 'left',
    fontWeight: '800',
    display: 'flex',
    gap: '14px',
    alignItems: 'center',
  },

  printSelected: {
    width: '100%',
    padding: '16px',
    marginTop: '8px',
    borderRadius: '13px',
    border: '2px solid #bda7ff',
    background: '#ffffff',
    color: '#090b3f',
    fontSize: '16px',
    textAlign: 'left',
    fontWeight: '900',
    display: 'flex',
    gap: '14px',
    alignItems: 'center',
  },

  copyBox: {
    width: '210px',
    height: '58px',
    margin: '0 auto',
    borderRadius: '16px',
    overflow: 'hidden',
    display: 'grid',
    gridTemplateColumns: '1fr 1.25fr 1fr',
    background: '#ffffff',
    boxShadow: '0 10px 24px rgba(0,0,0,0.16)',
  },

  copyButton: {
    border: 'none',
    background: '#ffffff',
    color: '#5b21ff',
    fontSize: '28px',
    fontWeight: '900',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
  },

  copyInput: {
    width: '100%',
    height: '100%',
    border: 'none',
    borderLeft: '1px solid #e5e7eb',
    borderRight: '1px solid #e5e7eb',
    outline: 'none',
    background: '#ffffff',
    color: '#080a3f',
    fontSize: '22px',
    fontWeight: '900',
    textAlign: 'center',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 0,
    boxSizing: 'border-box',
  },

  pageButtons: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: '10px',
  },

  pageButton: {
    padding: '13px',
    borderRadius: '14px',
    border: '1px solid rgba(255,255,255,0.24)',
    background: 'rgba(255,255,255,0.10)',
    color: '#ffffff',
    fontWeight: '800',
  },

  pageSelected: {
    padding: '13px',
    borderRadius: '14px',
    border: '1px solid #ffffff',
    background: '#ffffff',
    color: '#10105f',
    fontWeight: '900',
  },

  customInput: {
    width: '100%',
    marginTop: '12px',
    padding: '14px',
    boxSizing: 'border-box',
    borderRadius: '14px',
    border: 'none',
    outline: 'none',
    fontSize: '16px',
    fontWeight: '700',
    textAlign: 'center',
  },

  amountCard: {
    borderRadius: '22px',
    padding: '20px',
    marginBottom: '14px',
    textAlign: 'center',
    border: '1px solid rgba(255,255,255,0.24)',
    background: 'linear-gradient(135deg, #7f22ff 0%, #e915c8 100%)',
    boxShadow: '0 16px 34px rgba(0,0,0,0.22)',
    color: '#ffffff',
  },

  amountTitle: {
    margin: 0,
    color: '#ffffff',
    fontSize: '22px',
    fontWeight: '900',
  },

  amountValue: {
    display: 'block',
    fontSize: '48px',
    color: '#ffea00',
    marginTop: '10px',
    fontWeight: '900',
  },

  amountBreak: {
    margin: '8px 0 0',
    color: '#ffffff',
    fontSize: '17px',
    fontWeight: '800',
  },

  amountSmall: {
    display: 'block',
    marginTop: '6px',
    color: 'rgba(255,255,255,0.9)',
    fontWeight: '700',
  },

  onlinePay: {
    width: '100%',
    padding: '16px',
    borderRadius: '16px',
    border: '1px solid #6dff9c',
    background: 'linear-gradient(90deg, #13a84a, #049b45)',
    color: '#ffffff',
    fontSize: '17px',
    fontWeight: '900',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '12px',
  },

  cashPay: {
    width: '100%',
    padding: '16px',
    borderRadius: '16px',
    border: '1px solid #ffe600',
    background: 'transparent',
    color: '#ffe600',
    fontSize: '17px',
    fontWeight: '900',
    display: 'flex',
    justifyContent: 'center',
    gap: '12px',
    alignItems: 'center',
  },

  featureBox: {
    marginTop: '6px',
    borderRadius: '22px',
    padding: '18px 12px',
    display: 'grid',
    gridTemplateColumns: 'repeat(3, 1fr)',
    textAlign: 'center',
    background: 'rgba(255,255,255,0.10)',
    border: '1px solid rgba(255,255,255,0.10)',
    color: '#ffffff',
  },

  featureBoxCompact: {
    marginTop: '18px',
    borderRadius: '22px',
    padding: '18px 12px',
    display: 'grid',
    gridTemplateColumns: 'repeat(3, 1fr)',
    textAlign: 'center',
    background: 'rgba(255,255,255,0.10)',
    border: '1px solid rgba(255,255,255,0.10)',
    color: '#ffffff',
  },

  messageBox: {
    marginBottom: '14px',
    padding: '12px',
    borderRadius: '14px',
    background: 'rgba(255,255,255,0.16)',
    color: '#ffffff',
    textAlign: 'center',
    fontWeight: '800',
  },

  helpBox: {
    marginTop: '14px',
    padding: '13px',
    borderRadius: '14px',
    background: '#fff7ed',
    color: '#7c2d12',
    fontSize: '14px',
  },

  successCard: {
    marginTop: '60px',
    padding: '30px 20px',
    borderRadius: '24px',
    textAlign: 'center',
    background: 'rgba(255,255,255,0.10)',
    border: '1px solid rgba(255,255,255,0.18)',
    color: '#ffffff',
  },

  successIcon: {
    fontSize: '64px',
  },

  successTitle: {
    color: '#ffffff',
    margin: 0,
  },

  tokenBox: {
    fontSize: '40px',
    fontWeight: '900',
    color: '#ffea00',
    margin: '18px 0',
    wordBreak: 'break-word',
  },

  successStatus: {
    padding: '14px',
    borderRadius: '16px',
    background: 'rgba(255,255,255,0.12)',
    display: 'flex',
    justifyContent: 'space-between',
    color: '#ffffff',
  },

  successNote: {
    opacity: 0.92,
    color: '#ffffff',
  },

  redirectText: {
    fontSize: '13px',
    opacity: 0.8,
    color: '#ffffff',
  },

  successButton: {
    width: '100%',
    padding: '15px',
    borderRadius: '16px',
    border: 'none',
    background: '#22c55e',
    color: '#ffffff',
    fontWeight: '900',
    fontSize: '16px',
  },
};

if (!document.getElementById('falguni-upload-style')) {
  const styleTag = document.createElement('style');
  styleTag.id = 'falguni-upload-style';
  styleTag.innerHTML = `
    input[type="number"]::-webkit-outer-spin-button,
    input[type="number"]::-webkit-inner-spin-button {
      -webkit-appearance: none;
      margin: 0;
    }

    input[type="number"] {
      -moz-appearance: textfield;
    }

    button:disabled {
      opacity: 0.55;
      cursor: not-allowed;
    }
  `;
  document.head.appendChild(styleTag);
}