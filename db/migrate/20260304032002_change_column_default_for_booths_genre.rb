class ChangeColumnDefaultForBoothsGenre < ActiveRecord::Migration[8.1]
  def change
    change_column_default :booths, :genre, from: nil, to: ""
  end
end
