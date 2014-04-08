/** @jsx React.DOM */
var React = require('react/addons');
var sha512 = require('js-sha512').sha512;
var $ = require('jquery');
window.jQuery = $;
var messenger = require('messenger/build/js/messenger');
var pkg = require('./package.json');

// further setup

DEBUG = true;
BASE_PATH = DEBUG ? "http://dev.localhost:5000/v1/" : "http://api.it-se.me/v1/"


require('messenger/build/js/messenger-theme-flat');

Messenger.options = {
    extraClasses: 'messenger-fixed messenger-on-top messenger-on-right',
    theme: 'air'
}


var ListItem = React.createClass({
  mixins: [React.addons.LinkedStateMixin],
  getInitialState: function(){
    return {loading: true, confirmed: false, code: ""};
  },
  _get_key: function(){
    var account = this.props.account;
    if (!account.key)
      account.key = sha512(account.provider + ":" + account.id);
    return account.key;
  },
  askForRegister: function(){
    var me = this,
        account = this.props.account;
    this.setState({"loading": true});
    return $.get(BASE_PATH + "register/" + account.provider +
                "/" + account.id + "/" + this.props.jid
      ).done(function(res){
        if (res.confirmed) this.gotConfirmed();
        else {
          var account = this.props.account,
              provider = account.provider,
              id = account.id;
          if (res["goto"]){
            var message = "Please go here to confirm your account.";
            if (provider == "github") {
              message = "Please click here to verify your Github account: " + id
            } else if (provider == "facebook") {
              message = "Please click here to verify the Facebook account: " + id
            } else if (provider == "twitter") {
              message = "Please verify your twitter Account: " + id
            }
            Messenger().post({
              message: message,
              type: "info",
              hideAfter: 1000,
              showCloseButton: true,
              actions: {
                verify: {
                  label: "verify now",
                  action: function(){
                    window.open(res.goto);
                    msg.hide()
                  }
                },
                cancel: {
                  action: function(){
                    msg.hide()
                  }
                }
              }
            });
            this.setState({"loading": false});
          } else {
            var message = "A message with the verification code, has been sent to your account. Please look it up to confirm it's yours.";
            if (provider == "phone") {
              message = "A verification code has been sent via SMS to your phone. Please confirm it.";
            } else if (provider == "email") {
              message = "A verification code has been sent to your email.";
            }
            Messenger().post({
              message: message,
              type: "info",
              hideAfter: 10,
              showCloseButton: true
            });
            this.setState({"loading": false});
          }
        }
      }.bind(this)).fail(function(res){
        msg = "Error trying to register " + this.props.account.id;
        if (res["error"] && res["error"]["message"])
          msg += "\n" + res["error"]["message"];

        Messenger().post({
            message: msg,
            type: 'error',
            showCloseButton: true
          });
        this.setState({"confirmed": false, "loading": false});
      }.bind(this));
  },
  gotConfirmed: function() {
    this.setState({"confirmed": true, "loading": false});
    Messenger().run({successMessage: this.props.account.id + " confirmed"});
    if (this.props.onConfirmation) this.props.onConfirmation(this);
  },
  verify: function(){
    var code = prompt("What's the code, luke?");
    if (!code) return;

    this.setState({"loading": true});
    return $.get(BASE_PATH + "verify/" + this._get_key() + "?code=" + code
            ).done(function (res) {
                if (res.confirmed) this.gotConfirmed();
                else this.setState({"loading": false});
              }.bind(this)
            ).fail(function(resp){
                msg = "Error trying to register " + this.props.account.id;
                if (res["error"] && res["error"]["message"])
                  msg += "\n" + res["error"]["message"];

                Messenger().post({
                    message: msg,
                    type: 'error',
                    showCloseButton: true
                  });
                this.setState({"confirmed": false, "loading": false});
              }.bind(this)
            );
  },
  checkAgain: function(){
    this.setState({"loading": true});
    return $.get(BASE_PATH + "confirm/" + this._get_key() +
          "/" + this.props.jid
      ).done(function(res){
        if (res.confirmed) this.gotConfirmed();
        else this.setState({"loading": false});
      }.bind(this)).fail(function(){
        Messenger().post({
            message: 'Something went terribly wrong. Please reload.',
            type: 'error',
            showCloseButton: true
          });
        this.setState({"confirmed": false, "loading": false});
      });
  },
  componentDidMount: function(){
    if (this.props.account.confirmed){
      this.setState({"confirmed": true, "loading": false});
      return
    }
    this.checkAgain().done(function(res){
      if (!res.confirmed) this.askForRegister();
    }.bind(this));
  },
  render: function(){
    var embed = [<span>Loading...</span>];
    if (!this.state.loading) {
      if (this.state.confirmed){
        embed = [<span className="confirmed">✔</span>]
      } else {
        embed = [<span className="confirmed">pending</span>,
                 <a onClick={this.checkAgain}
                      className="reconfirm">↺</a>,
                 <button onClick={this.verify}
                      className="reconfirm">Verify now</button>];
      }
    }
    return (<div>
        <span className="protocol">{this.props.account.provider}</span>
        <span className="account">{this.props.account.id}</span>
        {embed}
      </div>) // <span onClick={this.removeMe} className="remove">⨯</span>
  }
})

var JidForm = React.createClass({
  mixins: [React.addons.LinkedStateMixin],

  getInitialState: function(){
    return {value: ""}
  },
  componentDidUpdate: function(){
    var itm = document.getElementById("jid-inpt");
    if (itm){ itm.focus() };
  },
  jidSubmit: function(ev){
    this.props.newJidCB(this.state["value"])
    return false;
  },
  render: function(){
    return (<form onSubmit={this.jidSubmit}>
              <input valueLink={this.linkState('value')}
                 type="email" id="jid-inpt"
                 placeholder="type your jabber-id" />
            </form>);
  }
});

var NewEntry = React.createClass({
  mixins: [React.addons.LinkedStateMixin],
  getInitialState: function() {
    return {"selected": "email", "value": ""};
  },
  onSubmit: function(){
    this.props.onSubmit({
        "provider": this.state["selected"],
        "id": this.state["value"]});
    this.setState({"value": ""});
    return false;
  },
  onChange: function(event){
    this.setState({selected: event.target["value"]})
  },
  render: function() {
    var input_type = "text", placeholder="";
    if (this.state.selected === "email"){
      input_type = "email";
      placeholder = "your email";
    } else if (this.state.selected === "xmpp"){
      input_type = "email";
      placeholder = "your account";
    } else if(this.state.selected === "phone"){
      input_type = "tel";
      placeholder = "+123 234 453423";
    } else if(this.state.selected === "facebook"){
      placeholder = "your facebook username";
    } else if(this.state.selected === "twitter"){
      placeholder = "@twitter account";
    } else if(this.state.selected === "github"){
      placeholder = "github handle";
    }
    return (<form onSubmit={this.onSubmit}>
        <label for="selectProvider">Provider</label>
        <select id="selectProvider" value={this.state.selected}
            onChange={this.onChange}>
            <option value="phone">Mobile Phone</option>
            <option value="facebook">Facebook</option>
            <option value="twitter">Twitter</option>
            <option value="github">Github</option>
            <option value="email">Email</option>
            <option value="xmpp">XMPP/Jabber</option>
            <option value="xmpp">GTalk/Hangouts</option>
        </select>
        <input type={input_type} placeholder={placeholder}
            valueLink={this.linkState("value")} />
      </form>) // maybe we'll add Skype in the future ...
  }
});

var MainContent = React.createClass({

  getInitialState: function() {
    return {interactive: false, jid: "",
            confirmed: false,
            accounts: []};
  },
  saveInStorage: function(){
    window.localStorage["itseme"] = JSON.stringify(this.state);
  },
  componentWillMount: function(){
    console.log("soon!");
    if (window['localStorage'] !== null){
      // local storage support. let's load stuff
      try {
        var last_state = window.localStorage["itseme"];
        if (last_state){
          this.setState(JSON.parse(last_state));
        }
      } catch(SyntaxError) {}
    } else {
      // no support, noop the save function
      this.saveInStorage = function() {};
    }
  },
  setInteractive: function(){
    this.setState({"interactive": true});
  },
  onJidConfirmation: function(){
    this.setState({"confirmed": true});
    this.saveInStorage();
  },
  newJid: function(jid){
    this.setState({"interactive": false, "jid": jid})
    this.saveInStorage();
  },
  newEntry: function(accountData){
    console.log(accountData);
    var accounts = this.state.accounts;
    accounts.push(accountData);
    this.setState({"accounts": accounts});
    this.saveInStorage();
  },
  render: function() {
    var embed = <h2 title="Click to change"
                    className="clickable"
                    onClick={this.setInteractive}>Mario*</h2>,
        footer = '';

    if (this.state.interactive){
      embed = <JidForm newJidCB={this.newJid}/>
    } else if (this.state.jid) {
      var accounts = this.state.accounts.map(function(item) {
        return <ListItem account={item} jid={this.state.jid} />
      }.bind(this));
      var data = {provider: "xmpp",
              id: this.state.jid,
              confirmed: this.state.confirmed}

      embed = <h2>{this.state.jid}</h2>
      footer = [<ListItem onConfirmation={this.onJidConfirmation}
                  preconfirm_first="1"
                  account={data}
                  jid={this.state.jid} />,
                <div>{accounts}</div>,
                <NewEntry onSubmit={this.newEntry} />]
    } else {
      footer = <div className="footnote">* click to edit</div>
    }

    return (<div>
              <header>
                <h1>it`se me</h1>
                <div className="i-wrap">
                  {embed}
                </div>
                <img src="./mustache.svg" className="mustache" alt="Mario`s mustache" />
            </header>
            {footer}
          </div>
        );
    }
});

React.renderComponent(
  <MainContent />,
  document.getElementById('content')
);
