import { useState, useEffect } from 'react';
import axios from 'axios';

export default function UploadPage() {
  const [files, setFiles] = useState([]);
  const [filePreviewUrls, setFilePreviewUrls] = useState([]);
  const [totalPages, setTotalPages] = useState(0);
  const [totalFiles, setTotalFiles] = useState(0);
  const [uploadedJobs, setUploadedJobs] = useState([]);
  const [copies, setCopies] = useState(1);
  const [duplex, setDuplex] = useState('single');
  const [price, setPrice] = useState(0);
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [payLoading, setPayLoading] = useState(false);
  const [showThankYou, setShowThankYou] = useState(false);
  const [finalToken, setFinalToken] = useState('');
  const [paymentMode, setPaymentMode] = useState('');
  const [showPaymentHelp, setShowPaymentHelp] = useState(false);
  const printRange = 'all';
  const customPages = '';
  const [redirectCount, setRedirectCount] = useState(10);

  const API_BASE_URL =
    import.meta.env.VITE_API_URL ||
    import.meta.env.VITE_API_BASE_URL ||
    'http://localhost:10000';

  const printType = 'single';
    
  const safeCopies = Math.min(Math.max(Number(copies || 1), 1), 99);

  const getBillablePages = () => {
    return totalPages;
  };

  const billablePages = getBillablePages();

  const calculateLocalPrice = (pages, side, copyCount) => {
    if (pages <= 0) return 0;
    const isDuplexPrint = side === 'long' || side === 'short';
    const rate = pages <= 5? 5 : isDuplexPrint? 3.5 : 3;
    const units = isDuplexPrint? Math.ceil(pages / 2) : pages;
    return Math.round(units * rate * Number(copyCount || 1));
  };

  useEffect(() => {
    if (totalPages > 0) {
      setPrice(calculateLocalPrice(billablePages, duplex, safeCopies));
    }
  }, [copies, duplex, totalPages, billablePages, safeCopies]);

  useEffect(() => {
    return () => {
      filePreviewUrls.forEach(url => URL.revokeObjectURL(url));
    };
  }, [filePreviewUrls]);

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
    const rate = billablePages <= 5? 5 : isDuplexPrint? 3.5 : 3;
    const units = isDuplexPrint? Math.ceil(billablePages / 2) : billablePages;
    const unitName = isDuplexPrint? 'Sheets' : 'Pages';
    return `${units} ${unitName} × Rs. ${rate} × ${safeCopies} Copy × ${totalFiles} Files`;
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
    setFiles([]);
    setFilePreviewUrls([]);
    setTotalPages(0);
    setTotalFiles(0);
    setUploadedJobs([]);
    setCopies(1);
    setDuplex('single');
    setPrice(0);
    setMessage('');
    setLoading(false);
    setPayLoading(false);
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
    const selectedFiles = Array.from(e.target.files);
    if (selectedFiles.length === 0) return;

    for (let f of selectedFiles) {
      const name = f.name.toLowerCase();
      const isValid =
        f.type.includes('pdf') ||
        f.type.includes('image') ||
        name.endsWith('.pdf') ||
        name.endsWith('.jpg') ||
        name.endsWith('.jpeg') ||
        name.endsWith('.png');

      if (!isValid) {
        setMessage('Only PDF, JPG, JPEG, PNG files allowed ❌');
        e.target.value = '';
        return;
      }

      if (f.size > 100 * 1024 * 1024) {
        setMessage('Max file size 100MB per file allowed ❌');
        e.target.value = '';
        return;
      }
    }

    filePreviewUrls.forEach(url => URL.revokeObjectURL(url));

    setFiles(selectedFiles);
    setFilePreviewUrls(selectedFiles.map(f => URL.createObjectURL(f)));
    setUploadedJobs([]);
    setMessage('');
    setShowPaymentHelp(false);
    setTotalPages(0);
    setTotalFiles(selectedFiles.length);
    setPrice(0);
  };

  const handleUpload = async () => {
    if (files.length === 0) {
      setMessage('Please select files first');
      return;
    }

    const formData = new FormData();
    files.forEach((file) => {
      formData.append('files', file);
    });

    setMessage('Uploading your files...');
    setShowPaymentHelp(false);
    setLoading(true);

    try {
      const res = await axios.post(`${API_BASE_URL}/api/upload`, formData);
      setTotalPages(res.data.totalPages || 0);
      setTotalFiles(res.data.totalFiles || files.length);
      setUploadedJobs(res.data.files || []);
      setMessage(`${res.data.totalFiles} files uploaded successfully ✅`);
    } catch (error) {
      console.log(error);
      setMessage(error.response?.data?.error || 'Upload failed ❌');
    } finally {
      setLoading(false);
    }
  };

  // CHANGE: બધા jobId નો Total Amount કાઢીને 1 જ Payment
  const handlePay = async () => {
    if (uploadedJobs.length === 0) {
      setMessage('Please upload files first');
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

      // પહેલી File નો jobId વાપરીશું Payment માટે
      const mainJobId = uploadedJobs[0].jobId;

      // CHANGE: totalJobIds Add કર્યું - બધા jobId Backend માં મોકલાશે
      const orderRes = await axios.post(
        `${API_BASE_URL}/api/jobs/${mainJobId}/pay/checkout-order`,
        {
          copies: safeCopies,
          printType,
          printRange,
          customPages,
          totalJobIds: JSON.stringify(uploadedJobs.map(j => j.jobId)) // આ Line Add કરી
        }
      );

      const data = orderRes.data;

      const options = {
        key: data.keyId,
        amount: data.amount, // Backend માંથી Total Amount આવશે
        currency: data.currency || 'INR',
        name: data.shopName || 'Falguni Xerox',
        description: `${billablePages} Pages × ${safeCopies} Copy × ${totalFiles} Files`,
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

            // Payment Success પછી બધા jobId verify કર
            for (let job of uploadedJobs) {
              await axios.post(`${API_BASE_URL}/api/payment/verify`, {
                jobId: job.jobId,
                razorpay_order_id: response.razorpay_order_id,
                razorpay_payment_id: response.razorpay_payment_id,
                razorpay_signature: response.razorpay_signature,
              });
            }

            setFinalToken(response.razorpay_payment_id);
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
    if (uploadedJobs.length === 0) {
      setMessage('Please upload files first');
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

      let totalAmount = 0;
      // બધા jobId પર cash order બનાવ
      for (let job of uploadedJobs) {
        const res = await axios.post(`${API_BASE_URL}/api/jobs/${job.jobId}/cash`, {
          copies: safeCopies,
          printType,
          printRange,
          customPages,
        });
        totalAmount += res.data.amount;
      }

      setPrice(totalAmount);
      setFinalToken(uploadedJobs[0].jobId);
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
          <span style={uploadedJobs.length > 0? styles.stepDone : styles.stepActive}>1 Upload</span>
          <span style={totalPages > 0? styles.stepActive : styles.step}>2 Setting</span>
          <span style={price > 0? styles.stepActive : styles.step}>3 Pay</span>
        </div>

        {totalPages <= 0 && (
          <>
            <section style={styles.uploadMainCard}>
              <div style={styles.bigFileIcon}>📄</div>
              <h2 style={styles.uploadTitle}>Upload Files</h2>
              <p style={styles.uploadSub}>PDF, JPG, JPEG, PNG</p>
              <p style={styles.uploadSub}>Max 100MB per file • Ctrl દબાવીને Multiple Select</p>

              <label style={styles.dropBox}>
                <input
                  type="file"
                  name="files"
                  multiple
                  onChange={handleFileChange}
                  accept=".pdf,.jpg,.jpeg,.png"
                  disabled={loading}
                  style={{ display: 'none' }}
                />
                <div style={styles.folderIcon}>📁</div>
                <b>{files.length > 0? `${files.length} Files Selected` : 'Select Files'}</b>
                <span>{files.length > 0? 'Files selected successfully' : 'or tap here to browse'}</span>
              </label>

              {files.length > 0 && (
                <div style={{ marginTop: '15px', textAlign: 'left', fontSize: '14px' }}>
                  {files.map((f, i) => (
                    <div key={i} style={{ padding: '4px 0' }}>
                      📄 {f.name} - {(f.size / 1024).toFixed(0)} KB
                    </div>
                  ))}
                </div>
              )}

              <button
                onClick={handleUpload}
                disabled={loading || files.length === 0}
                style={{
              ...styles.uploadPayButton,
                  opacity: loading || files.length === 0? 0.65 : 1,
                  cursor: loading || files.length === 0? 'not-allowed' : 'pointer',
                }}
              >
                {loading? 'Uploading...' : `Upload ${files.length} Files & Pay કરો`} <span>›</span>
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
                <h2 style={styles.panelTitle}>Files Summary</h2>
              </div>
              <div style={{ fontSize: '15px' }}>
                <p><b>Total Files:</b> {totalFiles}</p>
                <p><b>Total Pages:</b> {totalPages}</p>
              </div>
            </section>

            <section style={styles.panel}>
              <div style={styles.sectionTitle}>
                <span style={styles.sectionIcon}>🖨️</span>
                <h2 style={styles.panelTitle}>Print Type</h2>
              </div>

              <button
                onClick={() => setDuplex('single')}
                style={duplex === 'single'? styles.printSelected : styles.printButton}
              >
                <span>{duplex === 'single'? '◉' : '○'}</span> Single Side
              </button>

              <button
                onClick={() => setDuplex('long')}
                style={duplex === 'long'? styles.printSelected : styles.printButton}
              >
                <span>{duplex === 'long'? '◉' : '○'}</span> Double Side - Long Edge
              </button>

              <button
                onClick={() => setDuplex('short')}
                style={duplex === 'short'? styles.printSelected : styles.printButton}
              >
                <span>{duplex === 'short'? '◉' : '○'}</span> Double Side - Short Edge
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

            <section style={styles.amountCard}>
              <h2 style={styles.amountTitle}>Total Amount</h2>
              <b style={styles.amountValue}>Rs. {price}</b>
              <p style={styles.amountBreak}>{getPriceBreakdown()}</p>
              <small style={styles.amountSmall}>
                {totalFiles} files • {billablePages} pages • {totalSheets} sheets
              </small>
            </section>

            <section style={styles.panel}>
              <div style={styles.sectionTitle}>
                <span style={styles.sectionIcon}>📱</span>
                <h2 style={styles.panelTitle}>Payment</h2>
              </div>

              <button onClick={handlePay} disabled={payLoading} style={styles.onlinePay}>
                <span>🔒</span>
                {payLoading? 'Please wait...' : `Pay Online Rs. ${price}`}
                <b>›</b>
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
    <div style={compact? styles.featureBoxCompact : styles.featureBox}>
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
  width: "78px",
  height: "78px",
  margin: "0 auto 30px",
  borderRadius: "22px",
  display: "grid",
  placeItems: "center",
  background: "rgba(255,255,255,0.18)",
  fontSize: "38px",
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
  background: "linear-gradient(135deg, rgba(114,115,255,0.85), rgba(123,97,255,0.75))",
  backdropFilter: "blur(18px)",
  WebkitBackdropFilter: "blur(18px)",
  border: "1px solid rgba(255,255,255,0.18)",
  boxShadow: "0 10px 30px rgba(0,0,0,0.18)",
  color: "#ffffff",
  borderRadius: "24px",
  padding: "20px",
  marginBottom: "18px",
},
  sectionTitle: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    marginBottom: '15px',
  },
  sectionIcon: { fontSize: '24px' },
  panelTitle: { fontSize: '18px', fontWeight: 'bold', margin: 0 },
  printButton: {
    width: '100%',
    padding: '12px',
    marginBottom: '8px',
    borderRadius: '10px',
    border: '2px solid #e2e8f0',
    background: '#f8fafc',
    textAlign: 'left',
    cursor: 'pointer',
    fontSize: '15px',
  },
  printSelected: {
    width: '100%',
    padding: '12px',
    marginBottom: '8px',
    borderRadius: '10px',
    border: '2px solid #6366f1',
    background: '#e0e7ff',
    textAlign: 'left',
    cursor: 'pointer',
    fontSize: '15px',
    fontWeight: 'bold',
  },
  copyBox: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
  },
  copyButton: {
    width: '40px',
    height: '40px',
    borderRadius: '8px',
    border: '2px solid #cbd5e1',
    background: '#fff',
    fontSize: '20px',
    cursor: 'pointer',
  },
  copyInput: {
    flex: 1,
    height: '40px',
    textAlign: 'center',
    borderRadius: '8px',
    border: '2px solid #cbd5e1',
    fontSize: '16px',
  },
  amountCard: {
    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
    color: '#fff',
    borderRadius: '20px',
    padding: '25px',
    textAlign: 'center',
    marginBottom: '15px',
  },
  amountTitle: { fontSize: '18px', margin: '0 0 10px' },
  amountValue: { fontSize: '36px', display: 'block', margin: '10px 0' },
  amountBreak: { fontSize: '14px', margin: '8px 0' },
  amountSmall: { fontSize: '12px', opacity: 0.9 },
  onlinePay: {
    width: '100%',
    padding: '14px',
    borderRadius: '12px',
    border: 'none',
    background: '#10b981',
    color: '#fff',
    fontSize: '16px',
    fontWeight: 'bold',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '10px',
    cursor: 'pointer',
  },

  helpBox: {
    background: '#fef2f2',
    color: '#991b1b',
    padding: '12px',
    borderRadius: '10px',
    marginTop: '10px',
    fontSize: '13px',
  },
  successCard: {
    background: '#fff',
    color: '#1e293b',
    borderRadius: '20px',
    padding: '40px 30px',
    textAlign: 'center',
  },
  successIcon: { fontSize: '60px', marginBottom: '10px' },
  successTitle: { fontSize: '24px', fontWeight: 'bold', margin: '10px 0' },
  tokenBox: {
    fontSize: '48px',
    fontWeight: 'bold',
    color: '#6366f1',
    margin: '20px 0',
  },
  successStatus: {
    display: 'flex',
    justifyContent: 'space-between',
    padding: '15px',
    background: '#f1f5f9',
    borderRadius: '10px',
    margin: '20px 0',
  },
  successNote: { fontSize: '14px', color: '#64748b', margin: '15px 0' },
  redirectText: { fontSize: '13px', color: '#94a3b8', margin: '15px 0' },
  successButton: {
    width: '100%',
    padding: '14px',
    borderRadius: '12px',
    border: 'none',
    background: '#6366f1',
    color: '#fff',
    fontSize: '16px',
    fontWeight: 'bold',
    cursor: 'pointer',
  },
  featureBox: {
    display: 'flex',
    justifyContent: 'space-around',
    background: 'rgba(255,255,255,0.1)',
    borderRadius: '15px',
    padding: '20px',
    marginTop: '20px',
  },
  featureBoxCompact: {
    display: 'flex',
    justifyContent: 'space-around',
    background: 'rgba(255,255,255,0.1)',
    borderRadius: '15px',
    padding: '15px',
    marginTop: '15px',
    fontSize: '12px',
  },
};
