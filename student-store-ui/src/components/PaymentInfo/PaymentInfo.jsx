import "./PaymentInfo.css"

export default function PaymentInfo({ userInfo, setUserInfo, handleOnCheckout, isCheckingOut, error }) {
  return (
    <div className="PaymentInfo">
      <h3 className="">
        Payment Info{" "}
        <span className="button">
          <i className="material-icons md-48">monetization_on</i>
        </span>
      </h3>

      <div className="input-field">
        <label className="label">Email</label>
        <div className="control">
          <input
            className="input"
            type="email"
            placeholder="you@codepath.org"
            value={userInfo.customer_id}
            onChange={(e) => setUserInfo((u) => ({ ...u, customer_id: e.target.value }))}
          />
        </div>
      </div>

      <p className="is-danger">{error}</p>

      <div className="field">
        <div className="control">
          <button className="button" disabled={isCheckingOut} onClick={handleOnCheckout}>
            {isCheckingOut ? "Submitting..." : "Submit"}
          </button>
        </div>
      </div>
    </div>
  )
}
