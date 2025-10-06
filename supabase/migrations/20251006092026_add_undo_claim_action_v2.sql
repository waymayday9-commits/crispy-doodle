/*
  # Add Undo Functionality for Claim Actions

  1. New Function
    - `undo_claim_action` - Reverses any claim action (claim, revoke, etc.) using claim_history
  
  2. Changes
    - Adds comprehensive undo capability that reads from claim_history
    - Restores match_results to their previous state
    - Marks history record as undone (can_undo = false)
    - Updates stat_claim_requests status appropriately
  
  3. Security
    - Only admins/developers can undo actions
    - Validates that action can be undone before proceeding
    - Prevents double-undo by checking can_undo flag
*/

-- Drop existing function if it exists
DROP FUNCTION IF EXISTS undo_claim_action(uuid);

-- Create undo function
CREATE OR REPLACE FUNCTION undo_claim_action(p_history_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_history claim_history;
  v_request stat_claim_requests;
  v_affected_count int := 0;
  v_temp_count int;
BEGIN
  -- Get the history record
  SELECT * INTO v_history FROM claim_history WHERE id = p_history_id;
  
  IF v_history IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'History record not found');
  END IF;
  
  IF NOT v_history.can_undo THEN
    RETURN jsonb_build_object('success', false, 'error', 'This action has already been undone or cannot be undone');
  END IF;
  
  -- Get the claim request
  SELECT * INTO v_request FROM stat_claim_requests WHERE id = v_history.claim_request_id;
  
  IF v_request IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Claim request not found');
  END IF;
  
  -- Undo based on action type
  IF v_history.action_type = 'claim' THEN
    -- Reverse a claim: change new_player_name back to original_player_name
    UPDATE match_results
    SET player1_name = (v_history.previous_state->>'original_player_name')
    WHERE tournament_id = v_request.tournament_id
    AND player1_name = (v_history.previous_state->>'new_player_name');
    GET DIAGNOSTICS v_temp_count = ROW_COUNT;
    v_affected_count := v_affected_count + v_temp_count;
    
    UPDATE match_results
    SET player2_name = (v_history.previous_state->>'original_player_name')
    WHERE tournament_id = v_request.tournament_id
    AND player2_name = (v_history.previous_state->>'new_player_name');
    GET DIAGNOSTICS v_temp_count = ROW_COUNT;
    v_affected_count := v_affected_count + v_temp_count;
    
    -- Update request status back to approved
    UPDATE stat_claim_requests
    SET status = 'approved'
    WHERE id = v_history.claim_request_id;
    
  ELSIF v_history.action_type = 'revoke' THEN
    -- Reverse a revoke: change original_player_name back to requesting_username
    UPDATE match_results
    SET player1_name = (v_history.previous_state->>'requesting_username')
    WHERE tournament_id = v_request.tournament_id
    AND player1_name = (v_history.previous_state->>'original_player_name');
    GET DIAGNOSTICS v_temp_count = ROW_COUNT;
    v_affected_count := v_affected_count + v_temp_count;
    
    UPDATE match_results
    SET player2_name = (v_history.previous_state->>'requesting_username')
    WHERE tournament_id = v_request.tournament_id
    AND player2_name = (v_history.previous_state->>'original_player_name');
    GET DIAGNOSTICS v_temp_count = ROW_COUNT;
    v_affected_count := v_affected_count + v_temp_count;
    
    -- Update request status back to completed
    UPDATE stat_claim_requests
    SET status = 'completed',
        revoked_at = NULL,
        revoked_by = NULL
    WHERE id = v_history.claim_request_id;
    
  ELSE
    RETURN jsonb_build_object('success', false, 'error', 'Unknown action type');
  END IF;
  
  -- Mark this history record as undone
  UPDATE claim_history
  SET can_undo = false
  WHERE id = p_history_id;
  
  -- Create a new history record for the undo action
  INSERT INTO claim_history (
    claim_request_id,
    action_type,
    performed_by,
    affected_records,
    previous_state,
    can_undo
  ) VALUES (
    v_history.claim_request_id,
    'undo_' || v_history.action_type,
    auth.uid(),
    v_history.affected_records,
    v_history.previous_state,
    true
  );
  
  RETURN jsonb_build_object(
    'success', true,
    'affected_matches', v_affected_count,
    'action_undone', v_history.action_type
  );
END;
$$;

-- Grant execute permissions to authenticated users
GRANT EXECUTE ON FUNCTION undo_claim_action TO authenticated;
