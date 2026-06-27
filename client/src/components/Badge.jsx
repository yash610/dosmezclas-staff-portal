export default function Badge({ status }) {
  const map = {
    pending:   ['badge-yellow', 'Pending'],
    approved:  ['badge-green',  'Approved'],
    rejected:  ['badge-red',    'Rejected'],
    scheduled: ['badge-orange', 'Scheduled'],
    completed: ['badge-green',  'Completed'],
    cancelled: ['badge-gray',   'Cancelled'],
    swapped:   ['badge-gray',   'Swapped'],
    active:    ['badge-green',  'Active'],
    inactive:  ['badge-gray',   'Inactive'],
    transfer:  ['badge-orange', 'Transfer'],
    extra:     ['badge-green',  'Extra shift'],
  };
  const [cls, label] = map[status] || ['badge-gray', status || '—'];
  return <span className={cls}>{label}</span>;
}
