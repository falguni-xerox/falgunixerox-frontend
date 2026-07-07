import { useState, useEffect } from 'react';
import axios from 'axios';

export default function UploadPage() {
  const [files, setFiles] = useState([]);
  const [filePreviewUrls, setFilePreviewUrls] = useState([]);
  const [totalPages, setTotalPages] = useState(0);
  const [totalFiles, setTotalFiles] = useState(0);
  const [uploadedJobs, setUploadedJobs] = useState([]);
  const [copies, setCopies] = useState(1);
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

  const calculateLocalPrice = (pages, copyCount) => {
    if (pages <= 0) return 0;
    const rate = pages <= 5? 5 : 3;
    const units = pages;
    return Math.round(units * rate * Number(copyCount || 1));
  };

  useEffect(() => {
    if (totalPages > 0) {
      setPrice(calculateLocalPrice(billablePages, safeCopies));
    }
  }, [copies, totalPages, billablePages, safeCopies]);

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

  const totalSheets = billablePages * safeCopies;

  const getPriceBreakdown = () => {
    if (totalPages <= 0) return '';
    const rate = billablePages <= 5? 5 : 3;
    const units = billablePages;
    const unitName = 'Pages';
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

      const mainJobId = uploadedJobs[0].jobId;

      const orderRes = await axios.post(
        `${API_BASE_URL}/api/jobs/${mainJobId}/pay/checkout-order`,
        {
          copies: safeCopies,
          printType,
          printRange,
          customPages,
          totalJobIds: JSON.stringify(uploadedJobs.map(j => j.jobId))
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
            setMessage('Payment cancelled. Try again.');
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
              Printing started. Please collect your print from the counter.
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
  // બાકીના બધા styles એમ જ રહેવા દીધા...
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
    background: 'rgba(255,255,255,0.2)'
  }
  //...બાકીના styles તારા જૂના જ છે
};
