import { useState, useEffect } from 'react';
import axios from 'axios';

function Admin() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState('');

  const API_BASE_URL =
    import.meta.env.VITE_API_URL ||
    import.meta.env.VITE_API_BASE_URL ||
    'http://localhost:5000';

  const fetchOrders = async () => {
    try {
      const res = await axios.get(`${API_BASE_URL}/api/admin/orders`);
      setOrders(Array.isArray(res.data) ? res.data : res.data.orders || []);
    } catch (error) {
      console.log(error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOrders();
    const interval = setInterval(fetchOrders, 5000);
    return () => clearInterval(interval);
  }, []);

  const updateStatus = async (jobId, status) => {
    try {
      setActionLoading(`${jobId}-${status}`);
      await axios.post(`${API_BASE_URL}/api/admin/orders/${jobId}/status`, { status });
      await fetchOrders();
    } catch (error) {
      console.log(error);
      alert('Status update failed');
    } finally {
      setActionLoading('');
    }
  };

  const markCashPaid = async (jobId) => {
    try {
      setActionLoading(`${jobId}-cash-paid`);

      try {
        await axios.post(`${API_BASE_URL}/api/admin/jobs/${jobId}/cash-paid`);
      } catch {
        await axios.post(`${API_BASE_URL}/api/admin/orders/${jobId}/status`, {
          status: 'paid'
        });
      }

      await fetchOrders();
    } catch (error) {
      console.log(error);
      alert('Cash paid failed');
    } finally {
      setActionLoading('');
    }
  };

  const reprintOrder = async (jobId) => {
    if (!window.confirm('આ order ફરી print કરવો છે?')) return;

    try {
      setActionLoading(`${jobId}-reprint`);

      try {
        await axios.post(`${API_BASE_URL}/api/admin/jobs/${jobId}/reprint`);
      } catch {
        await axios.post(`${API_BASE_URL}/api/admin/orders/${jobId}/status`, {
          status: 'paid'
        });
      }

      await fetchOrders();
    } catch (error) {
      console.log(error);
      alert('Reprint failed');
    } finally {
      setActionLoading('');
    }
  };

  const cancelOrder = async (jobId) => {
    if (!window.confirm('Order cancel કરવો છે?')) return;
    await updateStatus(jobId, 'cancelled');
  };

  const getStatusColor = (status) => {
    if (status === 'printed' || status === 'done') return '#d4edda';
    if (status === 'printing') return '#fff3cd';
    if (status === 'paid') return '#d1ecf1';
    if (status === 'cash_pending' || status === 'cash') return '#ffe0b2';
    if (status === 'failed') return '#f8d7da';
    if (status === 'cancelled') return '#e2e3e5';
    return '#ffffff';
  };

  const formatTime = (order) => {
    const value = order.createdAt || order.created_at || order.time || order.date;
    if (!value) return '-';

    try {
      return new Date(value).toLocaleString('en-IN');
    } catch {
      return value;
    }
  };

  const getPaymentText = (order) => {
    if (order.payment?.method) return order.payment.method;
    if (order.paymentMethod) return order.paymentMethod;
    if (order.payment_method) return order.payment_method;
    if (order.razorpay_payment_id) return 'online';
    if (order.status === 'cash_pending' || order.status === 'cash') return 'cash';
    return '-';
  };

  if (loading) {
    return <h2 style={{ textAlign: 'center' }}>Loading Orders...</h2>;
  }

  return (
    <div style={{ padding: '20px', maxWidth: '1300px', margin: '0 auto' }}>
      <h1>Falguni Xerox - Admin Cash Counter</h1>

      <button
        onClick={fetchOrders}
        style={{
          marginBottom: '20px',
          padding: '10px 18px',
          background: '#0a8f08',
          color: 'white',
          border: 'none',
          borderRadius: '6px',
          cursor: 'pointer',
          fontWeight: 'bold'
        }}
      >
        Refresh
      </button>

      {orders.length === 0 ? (
        <p>No orders found</p>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', border: '1px solid #ddd', minWidth: '1100px' }}>
            <thead>
              <tr style={{ background: '#0a8f08', color: 'white' }}>
                <th style={th}>Token</th>
                <th style={th}>Time</th>
                <th style={th}>Pages</th>
                <th style={th}>Copies</th>
                <th style={th}>Type</th>
                <th style={th}>Amount</th>
                <th style={th}>Payment</th>
                <th style={th}>Status</th>
                <th style={th}>Action</th>
              </tr>
            </thead>

            <tbody>
              {orders.map((order) => {
                const jobId = order.jobId || order.id;
                const status = order.status || '-';
                const token = order.token || jobId || 'Online';

                return (
                  <tr key={jobId} style={{ background: getStatusColor(status) }}>
                    <td style={td}><b>#{token}</b></td>
                    <td style={td}>{formatTime(order)}</td>
                    <td style={td}>{order.pages || order.totalPages || '-'}</td>
                    <td style={td}>{order.copies || 1}</td>
                    <td style={td}>{order.printType || order.print_type || '-'}</td>
                    <td style={td}><b>₹{order.price || order.amount || 0}</b></td>
                    <td style={td}>{getPaymentText(order)}</td>
                    <td style={td}><b>{status.toUpperCase()}</b></td>

                    <td style={td}>
                      {(status === 'cash_pending' || status === 'cash') && (
                        <button
                          onClick={() => markCashPaid(jobId)}
                          disabled={actionLoading !== ''}
                          style={btnOrange}
                        >
                          Cash Received
                        </button>
                      )}

                      {status === 'paid' && (
                        <button
                          onClick={() => updateStatus(jobId, 'printing')}
                          disabled={actionLoading !== ''}
                          style={btnBlue}
                        >
                          Start Print
                        </button>
                      )}

                      {status === 'printing' && (
                        <button
                          onClick={() => updateStatus(jobId, 'printed')}
                          disabled={actionLoading !== ''}
                          style={btnGreen}
                        >
                          Mark Printed
                        </button>
                      )}

                      {(status === 'printed' || status === 'done' || status === 'failed') && (
                        <button
                          onClick={() => reprintOrder(jobId)}
                          disabled={actionLoading !== ''}
                          style={btnBlue}
                        >
                          Reprint
                        </button>
                      )}

                      {status !== 'printed' && status !== 'done' && status !== 'cancelled' && (
                        <button
                          onClick={() => cancelOrder(jobId)}
                          disabled={actionLoading !== ''}
                          style={btnRed}
                        >
                          Cancel
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

const th = {
  padding: '12px',
  border: '1px solid #ddd',
  textAlign: 'left'
};

const td = {
  padding: '10px',
  border: '1px solid #ddd'
};

const btnGreen = {
  background: '#0a8f08',
  color: 'white',
  border: 'none',
  padding: '7px 12px',
  borderRadius: '4px',
  cursor: 'pointer',
  marginRight: '6px',
  fontWeight: 'bold'
};

const btnOrange = {
  ...btnGreen,
  background: '#ff9800'
};

const btnBlue = {
  ...btnGreen,
  background: '#007bff'
};

const btnRed = {
  ...btnGreen,
  background: '#dc3545'
};

export default Admin;