import { useState, useEffect } from 'react';
import axios from 'axios';

export default function UploadPage() {
  const [files, setFiles] = useState([]); // CHANGE 1: Array બનાવ્યું
  const [filePreviewUrls, setFilePreviewUrls] = useState([]);
  const [totalPages, setTotalPages] = useState(0);
  const [totalFiles, setTotalFiles] = useState(0);
  const [uploadedJobs, setUploadedJobs] = useState([]); // બધા jobId અહીં Save થશે
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

  const printType =
    duplex === 'single'? 'single' : duplex === 'long'? 'duplex_long' : 'duplex_short';

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

  // CHANGE 2: Multiple File Handle કરવાનો
  const handleFileChange = (e) => {
    const selectedFiles = Array.from(e.target.files);
    if (selectedFiles.length === 0) return;

    // Validation બધી File માટે
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

    // જૂની Preview Clear કર
    filePreviewUrls.forEach(url => URL.revokeObjectURL(url));

    // બધી File + Preview Save કર
    setFiles(selectedFiles);
    setFilePreviewUrls(selectedFiles.map(f => URL.createObjectURL(f)));
    setUploadedJobs([]);
    setMessage('');
    setShowPaymentHelp(false);
    setTotalPages(0);
    setTotalFiles(selectedFiles.length);
    setPrice(0);
  };

  // CHANGE 3: બધી File Upload કરવાનો
  const handleUpload = async () => {
    if (files.length === 0) {
      setMessage('Please select files first');
      return;
    }

    const formData = new FormData();
    files.forEach((file) => {
      formData.append('files', file); // 'files' નામ જ રાખવાનું - Backend સાથે Match
    });

    setMessage('Uploading your files...');
    setShowPaymentHelp(false);
    setLoading(true);

    try {
      const res = await axios.post(`${API_BASE_URL}/api/upload`, formData);
      setTotalPages(res.data.totalPages || 0);
      setTotalFiles(res.data.totalFiles || files.length);
      setUploadedJobs(res.data.files || []); // બધા jobId અહીં મળશે
      setMessage(`${res.data.totalFiles} files uploaded successfully ✅`);
    } catch (error) {
      console.log(error);
      setMessage(error.response?.data?.error || 'Upload failed ❌');
    } finally {
      setLoading(false);
    }
  };

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

      const orderRes = await axios.post(
        `${API_BASE_URL}/api/jobs/${mainJobId}/pay/checkout-order`,
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
            const verifyRes = await axios.post(`${API_BASE_URL}/api/payment/verify`, {
              jobId: mainJobId,
              razorpay_order_id: response.razorpay_order_id,
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_signature: response.razorpay_signature,
            });

            setFinalToken(verifyRes.data.token || mainJobId);
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
      const mainJobId = uploadedJobs[0].jobId;
      const res = await axios.post(`${API_BASE_URL}/api/jobs/${mainJobId}/cash`, {
        copies: safeCopies,
        printType,
        printRange,
        customPages,
      });

      setFinalToken(res.data.token || mainJobId);
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
                {/* CHANGE 4: multiple attribute Add કર્યું */}
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

              {/* CHANGE 5: Selected Files ની List બતાવો */}
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
    marginTop: '20px',
    padding: '30px 20px',
    borderRadius: '18px',
    border: '2px dashed rgba(255,255,255,0.4)',
    background: 'rgba(255,255,255,0.1)',
    cursor: 'pointer',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '8px',
  },

  folderIcon: {
    fontSize: '40px',
  },

  uploadPayButton: {
    marginTop: '20px',
    width: '100%',
    padding: '16px',
    borderRadius: '16px',
    border: 'none',
    background: '#ffffff',
    color: '#10105f',
    fontSize: '18px',
    fontWeight: '900',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },

  panel: {
    marginTop: '20px',
    borderRadius: '20px',
    padding: '20px',
    border: '1px solid rgba(255,255,255,0.18)',
    background: 'rgba(255,255,255,0.08)',
  },

  sectionTitle: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    marginBottom: '15px',
  },

  sectionIcon: {
    fontSize: '24px',
  },

  panelTitle: {
    margin: 0,
    fontSize: '20px',
    fontWeight: '800',
  },

  printButton: {
    width: '100%',
    padding: '14px',
    marginBottom: '10px',
    borderRadius: '14px',
    border: '1px solid rgba(255,255,255,0.3)',
    background: 'rgba(255,255,255,0.1)',
    color: '#ffffff',
    fontSize: '16px',
    fontWeight: '700',
    textAlign: 'left',
    cursor: 'pointer',
  },

  printSelected: {
    width: '100%',
    padding: '14px',
    marginBottom: '10px',
    borderRadius: '14px',
    border: '2px solid #ffffff',
    background: 'rgba(255,255,255,0.25)',
    color: '#ffffff',
    fontSize: '16px',
    fontWeight: '900',
    textAlign: 'left',
    cursor: 'pointer',
  },

  copyBox: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
  },

  copyButton: {
    width: '45px',
    height: '45px',
    borderRadius: '12px',
    border: '1px solid rgba(255,255,255,0.3)',
    background: 'rgba(255,255,255,0.1)',
    color: '#ffffff',
    fontSize: '24px',
    fontWeight: '900',
    cursor: 'pointer',
  },

  copyInput: {
    flex: 1,
    padding: '12px',
    borderRadius: '12px',
    border: '1px solid rgba(255,255,255,0.3)',
    background: 'rgba(255,255,255,0.1)',
    color: '#ffffff',
    fontSize: '18px',
    fontWeight: '800',
    textAlign: 'center',
  },

  amountCard: {
    marginTop: '20px',
    borderRadius: '20px',
    padding: '24px',
    border: '2px solid rgba(255,255,255,0.3)',
    background: 'rgba(255,255,255,0.15)',
    textAlign: 'center',
  },

  amountTitle: {
    margin: 0,
    fontSize: '18px',
    fontWeight: '700',
    opacity: 0.9,
  },

  amountValue: {
    display: 'block',
    fontSize: '42px',
    fontWeight: '900',
    margin: '10px 0',
  },

  amountBreak: {
    margin: '8px 0',
    fontSize: '16px',
    opacity: 0.9,
  },

  amountSmall: {
    fontSize: '14px',
    opacity: 0.8,
  },

  onlinePay: {
    width: '100%',
    padding: '16px',
    marginBottom: '12px',
    borderRadius: '16px',
    border: 'none',
    background: '#ffffff',
    color: '#10105f',
    fontSize: '18px',
    fontWeight: '900',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    cursor: 'pointer',
  },

  cashPay: {
    width: '100%',
    padding: '16px',
    borderRadius: '16px',
    border: '2px solid #ffffff',
    background: 'transparent',
    color: '#ffffff',
    fontSize: '18px',
    fontWeight: '900',
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    gap: '8px',
    cursor: 'pointer',
  },

  helpBox: {
    marginTop: '15px',
    padding: '12px',
    borderRadius: '12px',
    background: 'rgba(255,193,7,0.2)',
    border: '1px solid rgba(255,193,7,0.5)',
    fontSize: '14px',
  },

  messageBox: {
    marginTop: '15px',
    padding: '12px',
    borderRadius: '12px',
    background: 'rgba(255,255,255,0.15)',
    textAlign: 'center',
    fontWeight: '700',
  },

  successCard: {
    borderRadius: '24px',
    padding: '40px 24px',
    border: '1px solid rgba(255,255,255,0.18)',
    background: 'rgba(255,255,255,0.08)',
    textAlign: 'center',
  },

  successIcon: {
    fontSize: '60px',
    marginBottom: '20px',
  },

  successTitle: {
    fontSize: '28px',
    fontWeight: '900',
    margin: '10px 0',
  },

  tokenBox: {
    fontSize: '48px',
    fontWeight: '900',
    padding: '20px',
    margin: '20px 0',
    borderRadius: '16px',
    background: 'rgba(255,255,255,0.2)',
    border: '3px solid #ffffff',
  },

  successStatus: {
    display: 'flex',
    justifyContent: 'space-between',
    padding: '12px 0',
    borderTop: '1px solid rgba(255,255,255,0.3)',
    borderBottom: '1px solid rgba(255,255,255,0.3)',
    margin: '20px 0',
  },

  successNote: {
    fontSize: '15px',
    opacity: 0.9,
    lineHeight: '1.5',
  },

  redirectText: {
    fontSize: '14px',
    opacity: 0.8,
    marginTop: '20px',
  },

  successButton: {
    marginTop: '20px',
    width: '100%',
    padding: '16px',
    borderRadius: '16px',
    border: 'none',
    background: '#ffffff',
    color: '#10105f',
    fontSize: '18px',
    fontWeight: '900',
    cursor: 'pointer',
  },

  featureBox: {
    marginTop: '20px',
    display: 'flex',
    justifyContent: 'space-around',
    textAlign: 'center',
  },

  featureBoxCompact: {
    marginTop: '15px',
    display: 'flex',
    justifyContent: 'space-around',
    textAlign: 'center',
    fontSize: '14px',
  },
};
