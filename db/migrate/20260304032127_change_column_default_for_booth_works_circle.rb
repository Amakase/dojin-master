class ChangeColumnDefaultForBoothWorksCircle < ActiveRecord::Migration[8.1]
  def change
    change_column_default :booth_works, :circle, from: nil, to: ""
  end
end
