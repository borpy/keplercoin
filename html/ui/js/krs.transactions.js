/******************************************************************************
 * Copyright © 2013-2016 The KPL Core Developers.                             *
 *                                                                            *
 * See the AUTHORS.txt, DEVELOPER-AGREEMENT.txt and LICENSE.txt files at      *
 * the top-level directory of this distribution for the individual copyright  *
 * holder information and the developer policies on copyright and licensing.  *
 *                                                                            *
 * Unless otherwise agreed in a custom licensing agreement, no part of the    *
 * KPL software, including this file, may be copied, modified, propagated,    *
 * or distributed except according to the terms contained in the LICENSE.txt  *
 * file.                                                                      *
 *                                                                            *
 * Removal or modification of this copyright notice is prohibited.            *
 *                                                                            *
 ******************************************************************************/

/**
 * @depends {krs.js}
 */
var krs = (function(krs, $, undefined) {

	krs.lastTransactions = "";
	krs.unconfirmedTransactions = [];
	krs.unconfirmedTransactionIds = "";
	krs.unconfirmedTransactionsChange = true;

	krs.handleIncomingTransactions = function(transactions, confirmedTransactionIds) {
		var oldBlock = (confirmedTransactionIds === false); //we pass false instead of an [] in case there is no new block..

		if (typeof confirmedTransactionIds != "object") {
			confirmedTransactionIds = [];
		}

		if (confirmedTransactionIds.length) {
			krs.lastTransactions = confirmedTransactionIds.toString();
		}

		if (confirmedTransactionIds.length || krs.unconfirmedTransactionsChange) {
			transactions.sort(krs.sortArray);
		}
		//Bug with popovers staying permanent when being open
		$('div.popover').hide();
		$('.td_transaction_phasing div.show_popover').popover('hide');

		//always refresh peers and unconfirmed transactions..
		if (krs.currentPage == "peers") {
			krs.incoming.peers();
		} else if (krs.currentPage == "transactions"
            && $('#transactions_type_navi').find('li.active a').attr('data-transaction-type') == "unconfirmed") {
			krs.incoming.transactions();
		} else {
			if (krs.currentPage != 'messages' && (!oldBlock || krs.unconfirmedTransactionsChange)) {
				if (krs.incoming[krs.currentPage]) {
					krs.incoming[krs.currentPage](transactions);
				}
			}
		}
		if (!oldBlock || krs.unconfirmedTransactionsChange) {
			// always call incoming for messages to enable message notifications
			krs.incoming['messages'](transactions);
			krs.updateNotifications();
			krs.setPhasingNotifications();
		}
	};

	krs.getUnconfirmedTransactions = function(callback) {
		krs.sendRequest("getUnconfirmedTransactions", {
			"account": krs.account
		}, function(response) {
			if (response.unconfirmedTransactions && response.unconfirmedTransactions.length) {
				var unconfirmedTransactions = [];
				var unconfirmedTransactionIds = [];

				response.unconfirmedTransactions.sort(function(x, y) {
					if (x.timestamp < y.timestamp) {
						return 1;
					} else if (x.timestamp > y.timestamp) {
						return -1;
					} else {
						return 0;
					}
				});
				
				for (var i = 0; i < response.unconfirmedTransactions.length; i++) {
					var unconfirmedTransaction = response.unconfirmedTransactions[i];
					unconfirmedTransaction.confirmed = false;
					unconfirmedTransaction.unconfirmed = true;
					unconfirmedTransaction.confirmations = "/";

					if (unconfirmedTransaction.attachment) {
						for (var key in unconfirmedTransaction.attachment) {
							if (!unconfirmedTransaction.attachment.hasOwnProperty(key)) {
								continue;
							}
							if (!unconfirmedTransaction.hasOwnProperty(key)) {
								unconfirmedTransaction[key] = unconfirmedTransaction.attachment[key];
							}
						}
					}
					unconfirmedTransactions.push(unconfirmedTransaction);
					unconfirmedTransactionIds.push(unconfirmedTransaction.transaction);
				}
				krs.unconfirmedTransactions = unconfirmedTransactions;
				var unconfirmedTransactionIdString = unconfirmedTransactionIds.toString();
				if (unconfirmedTransactionIdString != krs.unconfirmedTransactionIds) {
					krs.unconfirmedTransactionsChange = true;
					krs.setUnconfirmedNotifications();
					krs.unconfirmedTransactionIds = unconfirmedTransactionIdString;
				} else {
					krs.unconfirmedTransactionsChange = false;
				}

				if (callback) {
					callback(unconfirmedTransactions);
				}
			} else {
				krs.unconfirmedTransactions = [];
				if (krs.unconfirmedTransactionIds) {
					krs.unconfirmedTransactionsChange = true;
					krs.setUnconfirmedNotifications();
				} else {
					krs.unconfirmedTransactionsChange = false;
				}

				krs.unconfirmedTransactionIds = "";
				if (callback) {
					callback([]);
				}
			}
		});
	};

	krs.getInitialTransactions = function() {
		krs.sendRequest("getBlockchainTransactions", {
			"account": krs.account,
			"firstIndex": 0,
			"lastIndex": 9
		}, function(response) {
			if (response.transactions && response.transactions.length) {
				var transactions = [];
				var transactionIds = [];

				for (var i = 0; i < response.transactions.length; i++) {
					var transaction = response.transactions[i];
					transaction.confirmed = true;
					transactions.push(transaction);
					transactionIds.push(transaction.transaction);
				}
				krs.getUnconfirmedTransactions(function() {
					krs.loadPage('dashboard');
				});
			} else {
				krs.getUnconfirmedTransactions(function() {
					krs.loadPage('dashboard');
				});
			}
		});
	};

	krs.getNewTransactions = function() {
		//check if there is a new transaction..
		if (!krs.blocks[0]) {
			return;
		}
        krs.sendRequest("getBlockchainTransactions", {
			"account": krs.account,
			"timestamp": krs.blocks[0].timestamp + 1,
			"firstIndex": 0,
			"lastIndex": 0
		}, function(response) {
			//if there is, get latest 10 transactions
			if (response.transactions && response.transactions.length) {
				krs.sendRequest("getBlockchainTransactions", {
					"account": krs.account,
					"firstIndex": 0,
					"lastIndex": 9
				}, function(response) {
					if (response.transactions && response.transactions.length) {
						var transactionIds = [];

						$.each(response.transactions, function(key, transaction) {
							transactionIds.push(transaction.transaction);
							response.transactions[key].confirmed = true;
						});

						krs.getUnconfirmedTransactions(function(unconfirmedTransactions) {
							krs.handleIncomingTransactions(response.transactions.concat(unconfirmedTransactions), transactionIds);
						});
					} else {
						krs.getUnconfirmedTransactions(function(unconfirmedTransactions) {
							krs.handleIncomingTransactions(unconfirmedTransactions);
						});
					}
				});
			} else {
				krs.getUnconfirmedTransactions(function(unconfirmedTransactions) {
					krs.handleIncomingTransactions(unconfirmedTransactions);
				});
			}
		});
	};

	krs.addUnconfirmedTransaction = function(transactionId, callback) {
		krs.sendRequest("getTransaction", {
			"transaction": transactionId
		}, function(response) {
			if (!response.errorCode) {
				response.transaction = transactionId;
				response.confirmations = "/";
				response.confirmed = false;
				response.unconfirmed = true;

				if (response.attachment) {
					for (var key in response.attachment) {
                        if (!response.attachment.hasOwnProperty(key)) {
                            continue;
                        }
						if (!response.hasOwnProperty(key)) {
							response[key] = response.attachment[key];
						}
					}
				}
				var alreadyProcessed = false;
				try {
					var regex = new RegExp("(^|,)" + transactionId + "(,|$)");
					if (regex.exec(krs.lastTransactions)) {
						alreadyProcessed = true;
					} else {
						$.each(krs.unconfirmedTransactions, function(key, unconfirmedTransaction) {
							if (unconfirmedTransaction.transaction == transactionId) {
								alreadyProcessed = true;
								return false;
							}
						});
					}
				} catch (e) {
                    krs.logConsole(e.message);
                }

				if (!alreadyProcessed) {
					krs.unconfirmedTransactions.unshift(response);
				}
				if (callback) {
					callback(alreadyProcessed);
				}
				if (krs.currentPage == 'transactions' || krs.currentPage == 'dashboard') {
					$('div.popover').hide();
					$('.td_transaction_phasing div.show_popover').popover('hide');
					krs.incoming[krs.currentPage]();
				}

				krs.getAccountInfo();
			} else if (callback) {
				callback(false);
			}
		});
	};

	krs.sortArray = function(a, b) {
		return b.timestamp - a.timestamp;
	};

	krs.getTransactionIconHTML = function(type, subtype) {
		var iconHTML = krs.transactionTypes[type]['iconHTML'] + " " + krs.transactionTypes[type]['subTypes'][subtype]['iconHTML'];
		var tooltip = $.t(krs.transactionTypes[type].subTypes[subtype].i18nKeyTitle);
		return '<span title="' + tooltip + '" class="label label-primary" style="font-size:12px;">' + iconHTML + '</span>';
	};

	krs.addPhasedTransactionHTML = function(t) {
		var $tr = $('.tr_transaction_' + t.transaction + ':visible');
		var $tdPhasing = $tr.find('.td_transaction_phasing');
		var $approveBtn = $tr.find('.td_transaction_actions .approve_transaction_btn');

		if (t.attachment && t.attachment["version.Phasing"] && t.attachment.phasingVotingModel != undefined) {
			krs.sendRequest("getPhasingPoll", {
				"transaction": t.transaction,
				"countVotes": true
			}, function(responsePoll) {
				if (responsePoll.transaction) {
					krs.sendRequest("getPhasingPollVote", {
						"transaction": t.transaction,
						"account": krs.accountRS
					}, function(responseVote) {
						var attachment = t.attachment;
						var vm = attachment.phasingVotingModel;
						var minBalance = parseFloat(attachment.phasingMinBalance);
						var mbModel = attachment.phasingMinBalanceModel;

						if ($approveBtn) {
							var disabled = false;
							var unconfirmedTransactions = krs.unconfirmedTransactions;
							if (unconfirmedTransactions) {
								for (var i = 0; i < unconfirmedTransactions.length; i++) {
									var ut = unconfirmedTransactions[i];
									if (ut.attachment && ut.attachment["version.PhasingVoteCasting"] && ut.attachment.transactionFullHashes && ut.attachment.transactionFullHashes.length > 0) {
										if (ut.attachment.transactionFullHashes[0] == t.fullHash) {
											disabled = true;
											$approveBtn.attr('disabled', true);
										}
									}
								}
							}
							if (!disabled) {
								if (responseVote.transaction) {
									$approveBtn.attr('disabled', true);
								} else {
									$approveBtn.attr('disabled', false);
								}
							}
						}

						if (!responsePoll.result) {
							responsePoll.result = 0;
						}

						var state = "";
						var color = "";
						var icon = "";
						var minBalanceFormatted = "";
                        var finished = attachment.phasingFinishHeight <= krs.lastBlockHeight;
						var finishHeightFormatted = String(attachment.phasingFinishHeight);
						var percentageFormatted = attachment.phasingQuorum > 0 ? krs.calculatePercentage(responsePoll.result, attachment.phasingQuorum, 0) + "%" : "";
						var percentageProgressBar = attachment.phasingQuorum > 0 ? Math.round(responsePoll.result * 100 / attachment.phasingQuorum) : 0;
						var progressBarWidth = Math.round(percentageProgressBar / 2);
                        var approvedFormatted;
						if (responsePoll.approved || attachment.phasingQuorum == 0) {
							approvedFormatted = "Yes";
						} else {
							approvedFormatted = "No";
						}

						if (finished) {
							if (responsePoll.approved) {
								state = "success";
								color = "#00a65a";	
							} else {
								state = "danger";
								color = "#f56954";							
							}
						} else {
							state = "warning";
							color = "#f39c12";
						}

						var $popoverTable = $("<table class='table table-striped'></table>");
						var $popoverTypeTR = $("<tr><td></td><td></td></tr>");
						var $popoverVotesTR = $("<tr><td>" + $.t('votes', 'Votes') + ":</td><td></td></tr>");
						var $popoverPercentageTR = $("<tr><td>" + $.t('percentage', 'Percentage') + ":</td><td></td></tr>");
						var $popoverFinishTR = $("<tr><td>" + $.t('finish_height', 'Finish Height') + ":</td><td></td></tr>");
						var $popoverApprovedTR = $("<tr><td>" + $.t('approved', 'Approved') + ":</td><td></td></tr>");

						$popoverTypeTR.appendTo($popoverTable);
						$popoverVotesTR.appendTo($popoverTable);
						$popoverPercentageTR.appendTo($popoverTable);
						$popoverFinishTR.appendTo($popoverTable);
						$popoverApprovedTR.appendTo($popoverTable);

						$popoverPercentageTR.find("td:last").html(percentageFormatted);
						$popoverFinishTR.find("td:last").html(finishHeightFormatted);
						$popoverApprovedTR.find("td:last").html(approvedFormatted);

						var template = '<div class="popover" style="min-width:260px;"><div class="arrow"></div><div class="popover-inner">';
						template += '<h3 class="popover-title"></h3><div class="popover-content"><p></p></div></div></div>';

						var popoverConfig = {
							"html": true,
							"trigger": "hover",
							"placement": "top",
							"template": template
						};

						if (vm == -1) {
							icon = '<i class="fa ion-load-a"></i>';
						}
						if (vm == 0) {
							icon = '<i class="fa fa-group"></i>';
						}
						if (vm == 1) {
							icon = '<i class="fa fa-money"></i>';
						}
						if (vm == 2) {
							icon = '<i class="fa fa-signal"></i>';
						}
						if (vm == 3) {
							icon = '<i class="fa fa-bank"></i>';
						}
						if (vm == 4) {
							icon = '<i class="fa fa-thumbs-up"></i>';
						}
						if (vm == 5) {
							icon = '<i class="fa fa-question"></i>';
						}
						var phasingDiv = "";
						phasingDiv += '<div class="show_popover" style="display:inline-block;min-width:94px;text-align:left;border:1px solid #e2e2e2;background-color:#fff;padding:3px;" ';
	 				 	phasingDiv += 'data-toggle="popover" data-container="body">';
						phasingDiv += "<div class='label label-" + state + "' style='display:inline-block;margin-right:5px;'>" + icon + "</div>";
						
						if (vm == -1) {
							phasingDiv += '<span style="color:' + color + '">' + $.t("none") + '</span>';
						} else if (vm == 0) {
							phasingDiv += '<span style="color:' + color + '">' + String(responsePoll.result) + '</span> / <span>' + String(attachment.phasingQuorum) + '</span>';
						} else {
							phasingDiv += '<div class="progress" style="display:inline-block;height:10px;width: 50px;">';
	    					phasingDiv += '<div class="progress-bar progress-bar-' + state + '" role="progressbar" aria-valuenow="' + percentageProgressBar + '" ';
	    					phasingDiv += 'aria-valuemin="0" aria-valuemax="100" style="height:10px;width: ' + progressBarWidth + 'px;">';
	      					phasingDiv += '<span class="sr-only">' + percentageProgressBar + '% Complete</span>';
	    					phasingDiv += '</div>';
	  						phasingDiv += '</div> ';
	  					}
						phasingDiv += "</div>";
						var $phasingDiv = $(phasingDiv);
						popoverConfig["content"] = $popoverTable;
						$phasingDiv.popover(popoverConfig);
						$phasingDiv.appendTo($tdPhasing);
                        var votesFormatted;
						if (vm == 0) {
							$popoverTypeTR.find("td:first").html($.t('accounts', 'Accounts') + ":");
							$popoverTypeTR.find("td:last").html(String(attachment.phasingWhitelist ? attachment.phasingWhitelist.length : ""));
							votesFormatted = String(responsePoll.result) + " / " + String(attachment.phasingQuorum);
							$popoverVotesTR.find("td:last").html(votesFormatted);
						}
						if (vm == 1) {
							$popoverTypeTR.find("td:first").html($.t('accounts', 'Accounts') + ":");
							$popoverTypeTR.find("td:last").html(String(attachment.phasingWhitelist ? attachment.phasingWhitelist.length : ""));
							votesFormatted = krs.convertToKPL(responsePoll.result) + " / " + krs.convertToKPL(attachment.phasingQuorum) + " KPL";
							$popoverVotesTR.find("td:last").html(votesFormatted);
						}
						if (mbModel == 1) {
							if (minBalance > 0) {
								minBalanceFormatted = krs.convertToKPL(minBalance) + " KPL";
								$approveBtn.data('minBalanceFormatted', minBalanceFormatted.escapeHTML());
							}
						}
						if (vm == 2 || mbModel == 2) {
							krs.sendRequest("getAsset", {
								"asset": attachment.phasingHolding
							}, function(phResponse) {
								if (phResponse && phResponse.asset) {
									if (vm == 2) {
										$popoverTypeTR.find("td:first").html($.t('asset', 'Asset') + ":");
										$popoverTypeTR.find("td:last").html(String(phResponse.name));
										var votesFormatted = krs.convertToQNTf(responsePoll.result, phResponse.decimals) + " / ";
										votesFormatted += krs.convertToQNTf(attachment.phasingQuorum, phResponse.decimals) + " QNT";
										$popoverVotesTR.find("td:last").html(votesFormatted);
									}
									if (mbModel == 2) {
										if (minBalance > 0) {
											minBalanceFormatted = krs.convertToQNTf(minBalance, phResponse.decimals) + " QNT (" + phResponse.name + ")";
											$approveBtn.data('minBalanceFormatted', minBalanceFormatted.escapeHTML());
										}
									}
								}
							}, false);
						}
						if (vm == 3 || mbModel == 3) {
							krs.sendRequest("getCurrency", {
								"currency": attachment.phasingHolding
							}, function(phResponse) {
								if (phResponse && phResponse.currency) {
									if (vm == 3) {
										$popoverTypeTR.find("td:first").html($.t('currency', 'Currency') + ":");
										$popoverTypeTR.find("td:last").html(String(phResponse.code));
										var votesFormatted = krs.convertToQNTf(responsePoll.result, phResponse.decimals) + " / ";
										votesFormatted += krs.convertToQNTf(attachment.phasingQuorum, phResponse.decimals) + " Units";
										$popoverVotesTR.find("td:last").html(votesFormatted);
									}
									if (mbModel == 3) {
										if (minBalance > 0) {
											minBalanceFormatted = krs.convertToQNTf(minBalance, phResponse.decimals) + " Units (" + phResponse.code + ")";
											$approveBtn.data('minBalanceFormatted', minBalanceFormatted.escapeHTML());
										}
									}
								}
							}, false);
						}
					});
				} else {
					$tdPhasing.html("&nbsp;");
				}
			}, false);
		} else {
			$tdPhasing.html("&nbsp;");
		}
	};

	krs.addPhasingInfoToTransactionRows = function(transactions) {
		for (var i = 0; i < transactions.length; i++) {
			var transaction = transactions[i];
			krs.addPhasedTransactionHTML(transaction);
		}
	};


    krs.getTransactionRowHTML = function(t, actions, decimals) {
		var transactionType = $.t(krs.transactionTypes[t.type]['subTypes'][t.subtype]['i18nKeyTitle']);
		if (t.type == 1 && t.subtype == 6 && t.attachment.priceNQT == "0") {
			if (t.sender == krs.account && t.recipient == krs.account) {
				transactionType = $.t("alias_sale_cancellation");
			} else {
				transactionType = $.t("alias_transfer");
			}
		}
		var amount = "";
		var sign = 0;
		var fee = new BigInteger(t.feeNQT);
		var feeColor = "";
		var receiving = t.recipient == krs.account && !(t.sender == krs.account);
		if (receiving) {
			if (t.amountNQT != "0") {
				amount = new BigInteger(t.amountNQT);
				sign = 1;
			}
			feeColor = "color:black;";
		} else {
			if (t.sender != t.recipient) {
				if (t.amountNQT != "0") {
					amount = new BigInteger(t.amountNQT);
					amount = amount.negate();
					sign = -1;
				}
			} else {
				if (t.amountNQT != "0") {
					amount = new BigInteger(t.amountNQT); // send to myself
				}
			}
			feeColor = "color:red;";
		}
		var formattedAmount = "";
		if (amount != "") {
			formattedAmount = krs.formatAmount(amount, false, false, decimals.amount);
		}
		var formattedFee = krs.formatAmount(fee, false, false, decimals.fee);
		var amountColor = (sign == 1 ? "color:green;" : (sign == -1 ? "color:red;" : "color:black;"));
		var hasMessage = false;

		if (t.attachment) {
			if (t.attachment.encryptedMessage || t.attachment.message) {
				hasMessage = true;
			} else if (t.sender == krs.account && t.attachment.encryptToSelfMessage) {
				hasMessage = true;
			}
		}
		var html = "";
		html += "<tr class='tr_transaction_" + t.transaction + "'>";
		html += "<td style='vertical-align:middle;'>";
  		html += "<a class='show_transaction_modal_action' href='#' data-timestamp='" + String(t.timestamp).escapeHTML() + "' ";
  		html += "data-transaction='" + String(t.transaction).escapeHTML() + "'>";
  		html += krs.formatTimestamp(t.timestamp) + "</a>";
  		html += "</td>";
  		html += "<td style='vertical-align:middle;text-align:center;'>" + (hasMessage ? "&nbsp; <i class='fa fa-envelope-o'></i>&nbsp;" : "&nbsp;") + "</td>";
		html += '<td style="vertical-align:middle;">';
		html += krs.getTransactionIconHTML(t.type, t.subtype) + '&nbsp; ';
		html += '<span style="font-size:11px;display:inline-block;margin-top:5px;">' + transactionType + '</span>';
		html += '</td>';
        html += "<td style='vertical-align:middle;" + amountColor + "'>" + formattedAmount + "</td>";
        html += "<td style='vertical-align:middle;" + feeColor + "'>" + formattedFee + "</td>";
		html += "<td style='vertical-align:middle;'>" + ((krs.getAccountLink(t, "sender") == "/" && t.type == 2) ? "Asset Exchange" : krs.getAccountLink(t, "sender")) + " ";
		html += "<i class='fa fa-arrow-circle-right' style='color:#777;'></i> " + ((krs.getAccountLink(t, "recipient") == "/" && t.type == 2) ? "Asset Exchange" : krs.getAccountLink(t, "recipient")) + "</td>";
		html += "<td class='td_transaction_phasing' style='min-width:100px;vertical-align:middle;text-align:center;'></td>";
		html += "<td style='vertical-align:middle;text-align:center;'>" + (t.confirmed ? krs.getBlockLink(t.height, null, true) : "-") + "</td>";
		html += "<td class='confirmations' style='vertical-align:middle;text-align:center;font-size:12px;'>";
		html += "<span class='show_popover' data-content='" + (t.confirmed ? krs.formatAmount(t.confirmations) + " " + $.t("confirmations") : $.t("unconfirmed_transaction")) + "' ";
		html += "data-container='body' data-placement='left'>";
		html += (!t.confirmed ? "-" : (t.confirmations > 1440 ? (krs.formatAmount('144000000000') + "+") : krs.formatAmount(t.confirmations))) + "</span></td>";
		if (actions && actions.length != undefined) {
			html += '<td class="td_transaction_actions" style="vertical-align:middle;text-align:right;">';
			if (actions.indexOf('approve') > -1) {
                html += "<a class='btn btn-xs btn-default approve_transaction_btn' href='#' data-toggle='modal' data-target='#approve_transaction_modal' ";
				html += "data-transaction='" + String(t.transaction).escapeHTML() + "' data-fullhash='" + String(t.fullHash).escapeHTML() + "' ";
				html += "data-timestamp='" + t.timestamp + "' " + "data-votingmodel='" + t.attachment.phasingVotingModel + "' ";
				html += "data-fee='1' data-min-balance-formatted=''>" + $.t('approve') + "</a>";
			}
			html += "</td>";
		}
		html += "</tr>";
		return html;
	};

    krs.getLedgerEntryRow = function(entry, decimalParams) {
        var linkClass;
        var dataToken;
        if (entry.isTransactionEvent) {
            linkClass = "show_transaction_modal_action";
            dataToken = "data-transaction='" + String(entry.event).escapeHTML() + "'";
        } else {
            linkClass = "show_block_modal_action";
            dataToken = "data-id='1' data-block='" + String(entry.event).escapeHTML()+ "'";
        }
        var change = entry.change;
        var balance = entry.balance;
        var balanceType = "kpl";
        var balanceEntity = "kpl";
        var holdingIcon = "";
        if (change < 0) {
            change = String(change).substring(1);
        }
        if (/ASSET_BALANCE/i.test(entry.holdingType)) {
            krs.sendRequest("getAsset", {"asset": entry.holding}, function (response) {
                balanceType = "asset";
                balanceEntity = response.name;
                change = krs.formatQuantity(change, response.decimals, false, decimalParams.holdingChangeDecimals);
                balance = krs.formatQuantity(balance, response.decimals, false, decimalParams.holdingBalanceDecimals);
                holdingIcon = "<i class='fa fa-signal'></i> ";
            }, false);
        } else if (/CURRENCY_BALANCE/i.test(entry.holdingType)) {
            krs.sendRequest("getCurrency", {"currency": entry.holding}, function (response) {
                balanceType = "currency";
                balanceEntity = response.name;
                change = krs.formatQuantity(change, response.decimals, false, decimalParams.holdingChangeDecimals);
                balance = krs.formatQuantity(balance, response.decimals, false, decimalParams.holdingBalanceDecimals);
                holdingIcon =  "<i class='fa fa-bank'></i> ";
            }, false);
        } else {
            change = krs.formatAmount(change, false, false, decimalParams.changeDecimals);
            balance = krs.formatAmount(balance, false, false, decimalParams.balanceDecimals);
        }
        var sign = "";
		var color = "";
        if (entry.change > 0) {
			color = "color:green;";
		} else if (entry.change < 0) {
			color = "color:red;";
			sign = "-";
        }
        var eventType = String(entry.eventType).escapeHTML();
        if (eventType.indexOf("ASSET") == 0 || eventType.indexOf("CURRENCY") == 0) {
            eventType = eventType.substring(eventType.indexOf("_") + 1);
        }
        eventType = $.t(eventType.toLowerCase());
        var html = "";
		html += "<tr>";
		html += "<td style='vertical-align:middle;'>";
  		html += "<a class='show_ledger_modal_action' href='#' data-entry='" + String(entry.ledgerId).escapeHTML() +"'";
        html += "data-change='" + (entry.change < 0 ? ("-" + change) : change) + "' data-balance='" + balance + "'>";
  		html += krs.formatTimestamp(entry.timestamp) + "</a>";
  		html += "</td>";
		html += '<td style="vertical-align:middle;">';
        html += '<span style="font-size:11px;display:inline-block;margin-top:5px;">' + eventType + '</span>';
        html += "<a class='" + linkClass + "' href='#' data-timestamp='" + String(entry.timestamp).escapeHTML() + "' " + dataToken + ">";
        html += " <i class='fa fa-info'></i></a>";
		html += '</td>';
		if (balanceType == "kpl") {
            html += "<td style='vertical-align:middle;" + color + "' class='numeric'>" + sign + change + "</td>";
            html += "<td style='vertical-align:middle;' class='numeric'>" + balance + "</td>";
            html += "<td></td>";
            html += "<td></td>";
            html += "<td></td>";
        } else {
            html += "<td></td>";
            html += "<td></td>";
            html += "<td>" + holdingIcon + balanceEntity + "</td>";
            html += "<td style='vertical-align:middle;" + color + "' class='numeric'>" + sign + change + "</td>";
            html += "<td style='vertical-align:middle;' class='numeric'>" + balance + "</td>";
        }
		return html;
	};

	krs.buildTransactionsTypeNavi = function() {
		var html = '';
		html += '<li role="presentation" class="active"><a href="#" data-transaction-type="" ';
		html += 'data-toggle="popover" data-placement="top" data-content="All" data-container="body" data-i18n="[data-content]all">';
		html += '<span data-i18n="all">All</span></a></li>';
        var typeNavi = $('#transactions_type_navi');
        typeNavi.append(html);

		$.each(krs.transactionTypes, function(typeIndex, typeDict) {
			var titleString = $.t(typeDict.i18nKeyTitle);
			html = '<li role="presentation"><a href="#" data-transaction-type="' + typeIndex + '" ';
			html += 'data-toggle="popover" data-placement="top" data-content="' + titleString + '" data-container="body">';
			html += typeDict.iconHTML + '</a></li>';
			$('#transactions_type_navi').append(html);
		});

		html  = '<li role="presentation"><a href="#" data-transaction-type="unconfirmed" ';
		html += 'data-toggle="popover" data-placement="top" data-content="Unconfirmed (Account)" data-container="body" data-i18n="[data-content]unconfirmed_account">';
		html += '<i class="fa fa-circle-o"></i>&nbsp; <span data-i18n="unconfirmed">Unconfirmed</span></a></li>';
		typeNavi.append(html);
		
		html  = '<li role="presentation"><a href="#" data-transaction-type="phasing" ';
		html += 'data-toggle="popover" data-placement="top" data-content="Phasing (Pending)" data-container="body" data-i18n="[data-content]phasing_pending">';
		html += '<i class="fa fa-gavel"></i>&nbsp; <span data-i18n="phasing">Phasing</span></a></li>';
		typeNavi.append(html);

		html  = '<li role="presentation"><a href="#" data-transaction-type="all_unconfirmed" ';
		html += 'data-toggle="popover" data-placement="top" data-content="Unconfirmed (Everyone)" data-container="body" data-i18n="[data-content]unconfirmed_everyone">';
		html += '<i class="fa fa-circle-o"></i>&nbsp; <span data-i18n="all_unconfirmed">Unconfirmed (Everyone)</span></a></li>';
		typeNavi.append(html);

        typeNavi.find('a[data-toggle="popover"]').popover({
			"trigger": "hover"
		});
        typeNavi.find("[data-i18n]").i18n();
	};

	krs.buildTransactionsSubTypeNavi = function() {
        var subtypeNavi = $('#transactions_sub_type_navi');
        subtypeNavi.empty();
		var html  = '<li role="presentation" class="active"><a href="#" data-transaction-sub-type="">';
		html += '<span>' + $.t("all_types") + '</span></a></li>';
		subtypeNavi.append(html);

		var typeIndex = $('#transactions_type_navi').find('li.active a').attr('data-transaction-type');
		if (typeIndex && typeIndex != "unconfirmed" && typeIndex != "all_unconfirmed" && typeIndex != "phasing") {
			var typeDict = krs.transactionTypes[typeIndex];
			$.each(typeDict["subTypes"], function(subTypeIndex, subTypeDict) {
				var subTitleString = $.t(subTypeDict.i18nKeyTitle);
				html = '<li role="presentation"><a href="#" data-transaction-sub-type="' + subTypeIndex + '">';
				html += subTypeDict.iconHTML + ' ' + subTitleString + '</a></li>';
				$('#transactions_sub_type_navi').append(html);
			});
		}
	};

    krs.displayUnconfirmedTransactions = function(account) {
        var params = {
            "firstIndex": krs.pageNumber * krs.itemsPerPage - krs.itemsPerPage,
            "lastIndex": krs.pageNumber * krs.itemsPerPage
        };
        if (account != "") {
            params["account"] = account;
        }
        krs.sendRequest("getUnconfirmedTransactions", params, function(response) {
			var rows = "";
			if (response.unconfirmedTransactions && response.unconfirmedTransactions.length) {
				var decimals = krs.getTransactionsAmountDecimals(response.unconfirmedTransactions);
				for (var i = 0; i < response.unconfirmedTransactions.length; i++) {
                    rows += krs.getTransactionRowHTML(response.unconfirmedTransactions[i], false, decimals);
				}
			}
			krs.dataLoaded(rows);
		});
	};

	krs.displayPhasedTransactions = function() {
		var params = {
			"account": krs.account,
			"firstIndex": krs.pageNumber * krs.itemsPerPage - krs.itemsPerPage,
			"lastIndex": krs.pageNumber * krs.itemsPerPage
		};
		krs.sendRequest("getAccountPhasedTransactions", params, function(response) {
			var rows = "";

			if (response.transactions && response.transactions.length) {
				var decimals = krs.getTransactionsAmountDecimals(response.transactions);
				for (var i = 0; i < response.transactions.length; i++) {
					var t = response.transactions[i];
					t.confirmed = true;
					rows += krs.getTransactionRowHTML(t, false, decimals);
				}
				krs.dataLoaded(rows);
				krs.addPhasingInfoToTransactionRows(response.transactions);
			} else {
				krs.dataLoaded(rows);
			}
			
		});
	};

    krs.pages.dashboard = function() {
        var rows = "";
        var params = {
            "account": krs.account,
            "firstIndex": 0,
            "lastIndex": 9
        };
        var unconfirmedTransactions = krs.unconfirmedTransactions;
		var decimals = krs.getTransactionsAmountDecimals(unconfirmedTransactions);
        if (unconfirmedTransactions) {
            for (var i = 0; i < unconfirmedTransactions.length; i++) {
                rows += krs.getTransactionRowHTML(unconfirmedTransactions[i], false, decimals);
            }
        }

        krs.sendRequest("getBlockchainTransactions+", params, function(response) {
            if (response.transactions && response.transactions.length) {
				var decimals = krs.getTransactionsAmountDecimals(response.transactions);
                for (var i = 0; i < response.transactions.length; i++) {
                    var transaction = response.transactions[i];
                    transaction.confirmed = true;
                    rows += krs.getTransactionRowHTML(transaction, false, decimals);
                }

                krs.dataLoaded(rows);
                krs.addPhasingInfoToTransactionRows(response.transactions);
            } else {
                krs.dataLoaded(rows);
            }
        });
    };

	krs.incoming.dashboard = function() {
		krs.loadPage("dashboard");
	};

	var isHoldingEntry = function (entry){
		return /ASSET_BALANCE/i.test(entry.holdingType) || /CURRENCY_BALANCE/i.test(entry.holdingType);
	};

    krs.getLedgerNumberOfDecimals = function (entries){
		var decimalParams = {};
		decimalParams.changeDecimals = krs.getNumberOfDecimals(entries, "change", function(entry) {
			if (isHoldingEntry(entry)) {
				return "";
			}
			return krs.formatAmount(entry.change);
		});
		decimalParams.holdingChangeDecimals = krs.getNumberOfDecimals(entries, "change", function(entry) {
			if (isHoldingEntry(entry)) {
				return krs.formatQuantity(entry.change, entry.holdingInfo.decimals);
			}
			return "";
		});
		decimalParams.balanceDecimals = krs.getNumberOfDecimals(entries, "balance", function(entry) {
			if (isHoldingEntry(entry)) {
				return "";
			}
			return krs.formatAmount(entry.balance);
		});
		decimalParams.holdingBalanceDecimals = krs.getNumberOfDecimals(entries, "balance", function(entry) {
			if (isHoldingEntry(entry)) {
				return krs.formatQuantity(entry.balance, entry.holdingInfo.decimals);
			}
			return "";
		});
		return decimalParams;
	};

    krs.pages.ledger = function() {
		var rows = "";
        var params = {
            "account": krs.account,
            "includeHoldingInfo": true,
            "firstIndex": krs.pageNumber * krs.itemsPerPage - krs.itemsPerPage,
            "lastIndex": krs.pageNumber * krs.itemsPerPage
        };

        krs.sendRequest("getAccountLedger+", params, function(response) {
            if (response.entries && response.entries.length) {
                    console.log(response.entries.length);
                if (response.entries.length > krs.itemsPerPage) {
                    krs.hasMorePages = true;
                    response.entries.pop();
                }
				var decimalParams = krs.getLedgerNumberOfDecimals(response.entries);
                for (var i = 0; i < response.entries.length; i++) {
                    var entry = response.entries[i];
                    rows += krs.getLedgerEntryRow(entry, decimalParams);
                }
            }
            krs.dataLoaded(rows);
			if (krs.ledgerTrimKeep > 0) {
				var ledgerMessage = $("#account_ledger_message");
                ledgerMessage.text($.t("account_ledger_message", { blocks: krs.ledgerTrimKeep }));
				ledgerMessage.show();
			}
        });
	};

	krs.pages.transactions = function(callback, subpage) {
        var typeNavi = $('#transactions_type_navi');
        if (typeNavi.children().length == 0) {
			krs.buildTransactionsTypeNavi();
			krs.buildTransactionsSubTypeNavi();
		}

		if (subpage) {
			typeNavi.find('li a[data-transaction-type="' + subpage + '"]').click();
			return;
		}

		var selectedType = typeNavi.find('li.active a').attr('data-transaction-type');
		var selectedSubType = $('#transactions_sub_type_navi').find('li.active a').attr('data-transaction-sub-type');
		if (!selectedSubType) {
			selectedSubType = "";
		}
		if (selectedType == "unconfirmed") {
			krs.displayUnconfirmedTransactions(krs.account);
			return;
		}
		if (selectedType == "phasing") {
			krs.displayPhasedTransactions();
			return;
		}
		if (selectedType == "all_unconfirmed") {
			krs.displayUnconfirmedTransactions("");
			return;
		}

		var rows = "";
		var params = {
			"account": krs.account,
			"firstIndex": krs.pageNumber * krs.itemsPerPage - krs.itemsPerPage,
			"lastIndex": krs.pageNumber * krs.itemsPerPage
		};
        var unconfirmedTransactions;
		if (selectedType) {
			params.type = selectedType;
			params.subtype = selectedSubType;
			unconfirmedTransactions = krs.getUnconfirmedTransactionsFromCache(params.type, (params.subtype ? params.subtype : []));
		} else {
			unconfirmedTransactions = krs.unconfirmedTransactions;
		}
		var decimals = krs.getTransactionsAmountDecimals(unconfirmedTransactions);
		if (unconfirmedTransactions) {
			for (var i = 0; i < unconfirmedTransactions.length; i++) {
				rows += krs.getTransactionRowHTML(unconfirmedTransactions[i], false, decimals);
			}
		}

		krs.sendRequest("getBlockchainTransactions+", params, function(response) {
			if (response.transactions && response.transactions.length) {
				if (response.transactions.length > krs.itemsPerPage) {
					krs.hasMorePages = true;
					response.transactions.pop();
				}
				var decimals = krs.getTransactionsAmountDecimals(response.transactions);
				for (var i = 0; i < response.transactions.length; i++) {
					var transaction = response.transactions[i];
					transaction.confirmed = true;
					rows += krs.getTransactionRowHTML(transaction, false, decimals);
				}

				krs.dataLoaded(rows);
				krs.addPhasingInfoToTransactionRows(response.transactions);
			} else {
				krs.dataLoaded(rows);
			}
		});
	};

	krs.updateApprovalRequests = function() {
		var params = {
			"account": krs.account,
			"firstIndex": 0,
			"lastIndex": 20
		};
		krs.sendRequest("getVoterPhasedTransactions", params, function(response) {
			var $badge = $('#dashboard_link').find('.sm_treeview_submenu a[data-page="approval_requests_account"] span.badge');
			if (response.transactions && response.transactions.length) {
				if (response.transactions.length == 0) {
					$badge.hide();
				} else {
                    var length;
					if (response.transactions.length == 21) {
						length = "20+";
					} else {
						length = String(response.transactions.length);
					}
					$badge.text(length);
					$badge.show();
				}
			} else {
				$badge.hide();
			}
		});
		if (krs.currentPage == 'approval_requests_account') {
			krs.loadPage(krs.currentPage);
		}
	};

	krs.pages.approval_requests_account = function() {
		var params = {
			"account": krs.account,
			"firstIndex": krs.pageNumber * krs.itemsPerPage - krs.itemsPerPage,
			"lastIndex": krs.pageNumber * krs.itemsPerPage
		};
		krs.sendRequest("getVoterPhasedTransactions", params, function(response) {
			var rows = "";

			if (response.transactions && response.transactions.length) {
				if (response.transactions.length > krs.itemsPerPage) {
					krs.hasMorePages = true;
					response.transactions.pop();
				}
				var decimals = krs.getTransactionsAmountDecimals(response.transactions);
				for (var i = 0; i < response.transactions.length; i++) {
					var t = response.transactions[i];
					t.confirmed = true;
					rows += krs.getTransactionRowHTML(t, ['approve'], decimals);
				}
			}
			krs.dataLoaded(rows);
			krs.addPhasingInfoToTransactionRows(response.transactions);
		});
	};

	krs.incoming.transactions = function() {
		krs.loadPage("transactions");
	};

	krs.setup.transactions = function() {
		var sidebarId = 'dashboard_link';
		var options = {
			"id": sidebarId,
			"titleHTML": '<i class="fa fa-dashboard"></i> <span data-i18n="dashboard">Dashboard</span>',
			"page": 'dashboard',
			"desiredPosition": 10
		};
		krs.addTreeviewSidebarMenuItem(options);
		options = {
			"titleHTML": '<span data-i18n="dashboard">Dashboard</span>',
			"type": 'PAGE',
			"page": 'dashboard'
		};
		krs.appendMenuItemToTSMenuItem(sidebarId, options);
		options = {
			"titleHTML": '<span data-i18n="account_ledger">Account Ledger</span>',
			"type": 'PAGE',
			"page": 'ledger'
		};
		krs.appendMenuItemToTSMenuItem(sidebarId, options);
		options = {
			"titleHTML": '<span data-i18n="account_properties">Account Properties</span>',
			"type": 'PAGE',
			"page": 'account_properties'
		};
		krs.appendMenuItemToTSMenuItem(sidebarId, options);
		options = {
			"titleHTML": '<span data-i18n="my_transactions">My Transactions</span>',
			"type": 'PAGE',
			"page": 'transactions'
		};
		krs.appendMenuItemToTSMenuItem(sidebarId, options);
		options = {
			"titleHTML": '<span data-i18n="approval_requests">Approval Requests</span>',
			"type": 'PAGE',
			"page": 'approval_requests_account'
		};
		krs.appendMenuItemToTSMenuItem(sidebarId, options);
	};

	$(document).on("click", "#transactions_type_navi li a", function(e) {
		e.preventDefault();
		$('#transactions_type_navi').find('li.active').removeClass('active');
  		$(this).parent('li').addClass('active');
  		krs.buildTransactionsSubTypeNavi();
  		krs.pageNumber = 1;
		krs.loadPage("transactions");
	});

	$(document).on("click", "#transactions_sub_type_navi li a", function(e) {
		e.preventDefault();
		$('#transactions_sub_type_navi').find('li.active').removeClass('active');
  		$(this).parent('li').addClass('active');
  		krs.pageNumber = 1;
		krs.loadPage("transactions");
	});

	$(document).on("click", "#transactions_sub_type_show_hide_btn", function(e) {
		e.preventDefault();
        var subTypeNaviBox = $('#transactions_sub_type_navi_box');
        if (subTypeNaviBox.is(':visible')) {
			subTypeNaviBox.hide();
			$(this).text($.t('show_type_menu', 'Show Type Menu'));
		} else {
			subTypeNaviBox.show();
			$(this).text($.t('hide_type_menu', 'Hide Type Menu'));
		}
	});



	return krs;
}(krs || {}, jQuery));